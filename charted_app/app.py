import os
import uuid
import time
from datetime import timedelta
import pandas as pd
from flask import Flask, request, session, redirect, url_for, jsonify, render_template
from flask_session import Session
from pydantic import BaseModel, Field
from pydantic.types import constr
from typing import Optional
from sqlalchemy import create_engine, Column, String, Table, MetaData, Float, Integer, insert, text
import numpy as np


# Initialize Flask app
app = Flask(__name__)
app.secret_key = 'your_secret_key_change_this_in_production'

# Configure Flask-Session for server-side session storage
app.config['SESSION_TYPE'] = 'filesystem'
app.config['SESSION_FILE_DIR'] = os.path.join(os.getcwd(), 'session_files')
app.config['SESSION_FILE_THRESHOLD'] = 100
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=1)
Session(app)

# Define the path to the temporary directory
TMP_DIR = os.path.join(os.getcwd(), 'tmp')
os.makedirs(TMP_DIR, exist_ok=True)

# Limit file size to 16 MB
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024

# Cleanup functions
def cleanup_tmp_folder():
    now = time.time()
    for filename in os.listdir(TMP_DIR):
        file_path = os.path.join(TMP_DIR, filename)
        if os.path.isfile(file_path):
            if now - os.path.getmtime(file_path) > 360:
                os.remove(file_path)

def cleanup_session_files():
    session_dir = app.config['SESSION_FILE_DIR']
    if not os.path.exists(session_dir):
        return
    now = time.time()
    for filename in os.listdir(session_dir):
        file_path = os.path.join(session_dir, filename)
        if os.path.isfile(file_path):
            if now - os.path.getmtime(file_path) > app.config['PERMANENT_SESSION_LIFETIME'].total_seconds():
                os.remove(file_path)

@app.before_request
def before_request():
    cleanup_session_files()

# Pydantic Models
class Entity(BaseModel):
    ENTITY_ID: str = Field(..., description="Entity ID must be 6 digits or letters")
    ENTITY_NAME: str = Field(..., min_length=1, description="Entity Legal Name")
    ENTITY_TAX_JURISDICTION: Optional[str] = None

class Ownership(BaseModel):
    PARENT_ID: str = Field(..., description="ENTITY_ID of the Parent (shareholder)")
    CHILD_ID: str = Field(..., description="ENTITY_ID of the Child (subsidiary)")
    OWNERSHIP_PERC: float = Field(..., ge=0, le=100, description="Ownership percentage must be between 0 and 100")

class Person(BaseModel):
    PERSON_ID: str = Field(..., description="Person ID")
    PERSON_NAME: str = Field(..., min_length=1, description="Person Full Name")
    PERSON_ROLE: Optional[str] = None
    ENTITY_ID: Optional[str] = None

# Database setup
DATABASE_URL = "sqlite:///charted_entities.db"
engine = create_engine(DATABASE_URL, echo=True)
metadata = MetaData()

# Define table schemas
entities_table = Table(
    "entities",
    metadata,
    Column("ENTITY_ID", String, primary_key=True),
    Column("ENTITY_NAME", String, nullable=False),
    Column("ENTITY_TAX_JURISDICTION", String, nullable=True),
)

ownership_table = Table(
    "ownership",
    metadata,
    Column("RECORD_ID", Integer, primary_key=True),
    Column("PARENT_ID", String, nullable=False),
    Column("CHILD_ID", String, nullable=False),
    Column("OWNERSHIP_PERC", Float, nullable=False),
)

persons_table = Table(
    "persons",
    metadata,
    Column("PERSON_ID", String, primary_key=True),
    Column("PERSON_NAME", String, nullable=False),
    Column("PERSON_ROLE", String, nullable=True),
    Column("ENTITY_ID", String, nullable=True),
)

# Create tables
metadata.create_all(engine)

# Dataset configurations
DATASETS = {
    'entities': {
        'name': 'Entity Data',
        'description': 'Company and organization information',
        'standard_fields': ['ENTITY_ID', 'ENTITY_NAME', 'ENTITY_TAX_JURISDICTION'],
        'model': Entity,
        'table': entities_table
    },
    'ownership': {
        'name': 'Ownership Data', 
        'description': 'Parent-child ownership relationships',
        'standard_fields': ['PARENT_ID', 'CHILD_ID', 'OWNERSHIP_PERC'],
        'model': Ownership,
        'table': ownership_table
    },
    'persons': {
        'name': 'Person Data',
        'description': 'Individual people and their roles',
        'standard_fields': ['PERSON_ID', 'PERSON_NAME', 'PERSON_ROLE', 'ENTITY_ID'],
        'model': Person,
        'table': persons_table
    }
}

# Routes
@app.route('/')
def index():
    # Initialize upload status in session if not exists
    if 'upload_status' not in session:
        session['upload_status'] = {key: False for key in DATASETS.keys()}
    
    return render_template('index.html', datasets=DATASETS, upload_status=session['upload_status'])

@app.route('/upload/<dataset_type>', methods=['POST'])
def upload_file(dataset_type):
    cleanup_tmp_folder()
    
    if dataset_type not in DATASETS:
        return jsonify({"error": "Invalid dataset type"}), 400
    
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files['file']
    if not file.filename.endswith('.xlsx'):
        return jsonify({"error": "Invalid file format. Please upload an .xlsx file."}), 400

    try:
        df = pd.read_excel(file)
    except Exception as e:
        return jsonify({"error": f"Failed to read the file: {str(e)}"}), 500

    # Save DataFrame to temporary file
    temp_data_path = os.path.join(TMP_DIR, f"{uuid.uuid4()}.pickle")
    df.to_pickle(temp_data_path)

    # Store in session with dataset type
    session[f'{dataset_type}_incoming_fields'] = list(df.columns)
    session[f'{dataset_type}_data_path'] = temp_data_path

    return jsonify({
        "success": True,
        "incoming_fields": list(df.columns),
        "standard_fields": DATASETS[dataset_type]['standard_fields']
    })

@app.route('/map-fields/<dataset_type>', methods=['POST'])
def map_fields(dataset_type):
    if dataset_type not in DATASETS:
        return jsonify({"error": "Invalid dataset type"}), 400
    
    mapping = request.json.get('mapping', {})
    
    if not mapping:
        return jsonify({"error": "No field mapping provided"}), 400

    # Retrieve DataFrame from temporary file
    data_path = session.get(f'{dataset_type}_data_path')
    if not data_path or not os.path.exists(data_path):
        return jsonify({"error": "Data file not found. Please re-upload the file."}), 400

    try:
        df = pd.read_pickle(data_path)
        
        # Create column mapping (incoming_field -> standard_field)
        column_mapping = {incoming_field: standard_field 
                         for standard_field, incoming_field in mapping.items() 
                         if incoming_field and incoming_field in df.columns}
        
        if not column_mapping:
            return jsonify({"error": "No valid field mappings found"}), 400
        
        # Select and rename columns
        selected_columns = list(column_mapping.keys())
        reduced_df = df[selected_columns]
        final_df = reduced_df.rename(columns=column_mapping)
        
        # Clean data - handle NaN values
        final_df = final_df.where(pd.notnull(final_df), None)
        
        # Convert all fields to string except ownership percentage
        for col in final_df.columns:
            if col == 'OWNERSHIP_PERC':
                # Keep ownership percentage as numeric, but ensure it's float
                final_df[col] = pd.to_numeric(final_df[col], errors='coerce')
            else:
                # Convert all other fields to string
                final_df[col] = final_df[col].astype('string')
                # Clean up pandas 'None' strings and '<NA>' values
                final_df[col] = final_df[col].replace(['<NA>', 'None'], None)
        
        # Convert to dict for validation
        data_dict = final_df.to_dict(orient='records')
        
        # Validate using Pydantic
        validated_data = []
        model_class = DATASETS[dataset_type]['model']
        
        for row in data_dict:
            try:
                validated_entity = model_class(**row)
                validated_data.append(validated_entity.model_dump())
            except Exception as e:
                return jsonify({"error": f"Validation failed: {str(e)}"}), 400

        # Insert into database
        table = DATASETS[dataset_type]['table']
        with engine.connect() as conn:
            conn.execute(insert(table), validated_data)
            conn.commit()

        # Update upload status
        upload_status = session.get('upload_status', {})
        upload_status[dataset_type] = True
        session['upload_status'] = upload_status

        # Clean up temporary file
        os.remove(data_path)
        session.pop(f'{dataset_type}_incoming_fields', None)
        session.pop(f'{dataset_type}_data_path', None)

        return jsonify({
            "success": True,
            "message": f"{DATASETS[dataset_type]['name']} successfully processed!",
            "records_processed": len(validated_data)
        })

    except Exception as e:
        return jsonify({"error": f"Processing failed: {str(e)}"}), 500

@app.route('/org-chart-data')
def get_org_chart_data():
    """Get data for D3.js org chart"""
    try:
        with engine.connect() as conn:
            # Get entities
            entities_result = conn.execute(text("SELECT * FROM entities")).fetchall()
            entities = [dict(row._mapping) for row in entities_result]
            
            # Get ownership relationships
            ownership_result = conn.execute(text("SELECT * FROM ownership")).fetchall()
            ownership = [dict(row._mapping) for row in ownership_result]
            
            # Get persons
            persons_result = conn.execute(text("SELECT * FROM persons")).fetchall()
            persons = [dict(row._mapping) for row in persons_result]
            
            return jsonify({
                "entities": entities,
                "ownership": ownership,
                "persons": persons
            })
    except Exception as e:
        return jsonify({"error": f"Failed to fetch data: {str(e)}"}), 500

@app.route('/reset-data', methods=['POST'])
def reset_data():
    """Reset all data and upload status"""
    try:
        with engine.connect() as conn:
            conn.execute(text("DELETE FROM entities"))
            conn.execute(text("DELETE FROM ownership"))
            conn.execute(text("DELETE FROM persons"))
            conn.commit()
        
        # Reset session
        session['upload_status'] = {key: False for key in DATASETS.keys()}
        
        return jsonify({"success": True, "message": "All data reset successfully"})
    except Exception as e:
        return jsonify({"error": f"Reset failed: {str(e)}"}), 500

if __name__ == '__main__':
    # For development
    app.run(debug=True)
else:
    # For production (Gunicorn)
    app.secret_key = os.environ.get('SECRET_KEY', 'your_secret_key_change_this_in_production')
