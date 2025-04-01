from flask import Flask, request, jsonify
import google.generativeai as genai
from flask_cors import CORS
import os
import json
import time
import logging
from logging.handlers import RotatingFileHandler
from dotenv import load_dotenv
from functools import lru_cache
import threading
import queue
import uuid
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
# Enable CORS for all routes, with appropriate configuration for your React app
CORS(app, resources={r"/api/*": {"origins": "*"}})  # Adjust origins as needed for production

# Configure app
app.config.update(
    SECRET_KEY=os.getenv('SECRET_KEY', os.urandom(24).hex()),
    MAX_HISTORY_ITEMS=int(os.getenv('MAX_HISTORY_ITEMS', 100)),
    HISTORY_FILE=os.getenv('HISTORY_FILE', 'command_history.json'),
    DEBUG=os.getenv('DEBUG', 'False').lower() == 'true',
    API_KEY=os.getenv('GEMINI_API_KEY', ''),
    LOG_LEVEL=os.getenv('LOG_LEVEL', 'INFO')
)

# Configure rate limiting
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["100 per day", "20 per hour"],
    storage_uri="memory://"
)

# Configure logging
log_level = getattr(logging, app.config['LOG_LEVEL'])
handler = RotatingFileHandler('app.log', maxBytes=10000000, backupCount=5)
handler.setLevel(log_level)
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
handler.setFormatter(formatter)
app.logger.addHandler(handler)
app.logger.setLevel(log_level)

# Validate API key
if not app.config['API_KEY'] or app.config['API_KEY'] == 'Replace with your actual API key':
    app.logger.error("No valid API key found. Please set GEMINI_API_KEY in environment or .env file.")
    raise ValueError("API Key is required. Set GEMINI_API_KEY in environment or .env file.")

# Configure the Gemini API
genai.configure(api_key=app.config['API_KEY'])

# Model configurations
MODEL_CONFIGS = {
    "gemini-1.5-pro": {
        "default": {
            "temperature": 0.7,
            "top_p": 0.95,
            "top_k": 40,
            "max_output_tokens": 1024,
        },
        "creative": {
            "temperature": 0.9,
            "top_p": 0.98,
            "top_k": 50,
            "max_output_tokens": 2048,
        },
        "precise": {
            "temperature": 0.3,
            "top_p": 0.85,
            "top_k": 30,
            "max_output_tokens": 1024,
        }
    },
    "gemini-1.5-flash": {
        "default": {
            "temperature": 0.7,
            "top_p": 0.95,
            "top_k": 40,
            "max_output_tokens": 1024,
        }
    }
}

# Default safety settings
SAFETY_SETTINGS = [
    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
]

# Create model instances for each configuration
models = {}
for model_name, configs in MODEL_CONFIGS.items():
    models[model_name] = {}
    for config_name, config in configs.items():
        models[model_name][config_name] = genai.GenerativeModel(
            model_name=model_name,
            generation_config=config,
            safety_settings=SAFETY_SETTINGS
        )

# Initialize command history
command_history = []

# Load history from file if it exists
def load_history():
    try:
        if os.path.exists(app.config['HISTORY_FILE']):
            with open(app.config['HISTORY_FILE'], 'r') as f:
                return json.load(f)
    except Exception as e:
        app.logger.error(f"Error loading history: {str(e)}")
    return []

# Save history to file
def save_history():
    try:
        with open(app.config['HISTORY_FILE'], 'w') as f:
            json.dump(command_history, f)
    except Exception as e:
        app.logger.error(f"Error saving history: {str(e)}")

# Initialize history
command_history = load_history()

# Request queue for background processing
request_queue = queue.Queue()
results = {}

# Thread worker function
def process_requests():
    while True:
        try:
            job_id, command, model_name, config_name = request_queue.get()
            if job_id == "STOP":
                break
            
            app.logger.info(f"Processing job {job_id}: {command[:50]}...")
            results[job_id] = {"status": "processing", "progress": 0}
            
            code, explanation = generate_code_snippet(command, model_name, config_name)
            
            results[job_id] = {
                "status": "completed",
                "code": code,
                "explanation": explanation,
                "timestamp": time.time()
            }
            app.logger.info(f"Completed job {job_id}")
            
            # Cleanup old results
            cleanup_old_results()
        except Exception as e:
            app.logger.error(f"Error in worker thread: {str(e)}")
            if job_id:
                results[job_id] = {"status": "error", "error": str(e)}
        finally:
            request_queue.task_done()

# Start worker threads
worker_threads = []
for _ in range(3):  # Number of worker threads
    thread = threading.Thread(target=process_requests, daemon=True)
    thread.start()
    worker_threads.append(thread)

# Clean up old results to prevent memory leaks
def cleanup_old_results():
    current_time = time.time()
    to_delete = []
    for job_id, result in results.items():
        if result.get("status") == "completed" and current_time - result.get("timestamp", 0) > 3600:
            to_delete.append(job_id)
    
    for job_id in to_delete:
        del results[job_id]

# LRU cache for common requests
@lru_cache(maxsize=100)
def cached_generate_code(command, model_name, config_name):
    """Cached version of code generation for common requests."""
    model = models.get(model_name, {}).get(config_name)
    if not model:
        app.logger.error(f"Model not found: {model_name}/{config_name}")
        return "", f"Model configuration not found: {model_name}/{config_name}"
    
    try:
        prompt = f"""You are a Python coding assistant. Generate a concise, working code snippet for the following command:
        
        {command}
        
        Provide only the Python code without any explanation or markdown formatting."""
        
        response = model.generate_content(prompt)
        
        if response:
            # Extract the code from the response
            code = response.text.strip()
            
            # Generate a brief explanation (don't cache this part)
            explanation_prompt = f"Provide a brief explanation for this Python code: {code}"
            explanation_response = model.generate_content(explanation_prompt)
            explanation = explanation_response.text.strip() if explanation_response else f"Code for: {command}"
            
            return code, explanation
        else:
            return "", "Failed to generate code snippet. Please try again."
     
    except Exception as e:
        app.logger.error(f"Error generating code: {str(e)}")
        return "", f"Error: {str(e)}"

def generate_code_snippet(command, model_name="gemini-1.5-pro", config_name="default"):
    """Generate code snippet based on the command using Google's Gemini API."""
    # Check if command is a common one that might be cached
    if len(command) < 200:  # Only cache shorter commands
        try:
            return cached_generate_code(command, model_name, config_name)
        except Exception as e:
            app.logger.warning(f"Cache miss or error: {str(e)}")
    
    # If not in cache or too long, generate normally
    model = models.get(model_name, {}).get(config_name)
    if not model:
        app.logger.error(f"Model not found: {model_name}/{config_name}")
        return "", f"Model configuration not found: {model_name}/{config_name}"
    
    try:
        prompt = f"""You are a Python coding assistant. Generate a concise, working code snippet for the following command:
        
        {command}
        
        Provide only the Python code without any explanation or markdown formatting."""
        
        response = model.generate_content(prompt)
        
        if response:
            # Extract the code from the response
            code = response.text.strip()
            
            # Generate a brief explanation
            explanation_prompt = f"Provide a brief explanation for this Python code: {code}"
            explanation_response = model.generate_content(explanation_prompt)
            explanation = explanation_response.text.strip() if explanation_response else f"Code for: {command}"
            
            # Add to history (limit to configured max items)
            new_entry = {
                "id": str(uuid.uuid4()),
                "command": command,
                "code": code,
                "explanation": explanation,
                "model": model_name,
                "config": config_name,
                "timestamp": time.time()
            }
            
            global command_history
            command_history.append(new_entry)
            if len(command_history) > app.config['MAX_HISTORY_ITEMS']:
                command_history.pop(0)
            
            # Save history to file
            save_history()
            
            return code, explanation
        else:
            return "", "Failed to generate code snippet. Please try again."
     
    except Exception as e:
        app.logger.error(f"Error generating code: {str(e)}")
        return "", f"Error: {str(e)}"

# API endpoints
@app.route('/api/models', methods=['GET'])
def get_models():
    """Return available models and configurations"""
    return jsonify(dict((model, list(configs.keys())) for model, configs in MODEL_CONFIGS.items()))

@app.route('/api/generate_code', methods=['POST'])
@limiter.limit("20 per minute")
def generate_code():
    """Generate code synchronously (for simple requests)"""
    try:
        data = request.json
        command = data.get('command')
        model_name = data.get('model', 'gemini-1.5-pro')
        config_name = data.get('config', 'default')
    
        if not command:
            return jsonify({"error": "Command is required"}), 400
    
        app.logger.info(f"Generating code for: {command[:50]}...")
        code, explanation = generate_code_snippet(command, model_name, config_name)
         
        if not code:
            return jsonify({"error": explanation}), 500
    
        return jsonify({
            "code": code,
            "explanation": explanation,
            "model": model_name,
            "config": config_name
        }), 200
    except Exception as e:
        app.logger.error(f"Error in generate_code: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/generate_code_async', methods=['POST'])
@limiter.limit("40 per minute")
def generate_code_async():
    """Submit a code generation job to be processed asynchronously"""
    try:
        data = request.json
        command = data.get('command')
        model_name = data.get('model', 'gemini-1.5-pro')
        config_name = data.get('config', 'default')
    
        if not command:
            return jsonify({"error": "Command is required"}), 400
    
        job_id = str(uuid.uuid4())
        request_queue.put((job_id, command, model_name, config_name))
        results[job_id] = {"status": "queued"}
    
        return jsonify({
            "job_id": job_id,
            "status": "queued"
        }), 202
    except Exception as e:
        app.logger.error(f"Error in generate_code_async: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/job_status/<job_id>', methods=['GET'])
def job_status(job_id):
    """Check the status of an asynchronous job"""
    if job_id not in results:
        return jsonify({"error": "Job not found"}), 404
    
    return jsonify(results[job_id]), 200

@app.route('/api/history', methods=['GET'])
def get_history():
    """Get command history"""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    
    # Basic pagination
    start = (page - 1) * per_page
    end = start + per_page
    
    # Sort by timestamp (newest first)
    sorted_history = sorted(command_history, key=lambda x: x.get("timestamp", 0), reverse=True)
    paginated_history = sorted_history[start:end]
    
    return jsonify({
        "items": paginated_history,
        "total": len(command_history),
        "page": page,
        "per_page": per_page,
        "total_pages": (len(command_history) + per_page - 1) // per_page
    }), 200

@app.route('/api/history/<entry_id>', methods=['GET'])
def get_history_entry(entry_id):
    """Get a specific history entry by ID"""
    for entry in command_history:
        if entry.get("id") == entry_id:
            return jsonify(entry), 200
    
    return jsonify({"error": "Entry not found"}), 404

@app.route('/api/history/<entry_id>', methods=['DELETE'])
def delete_history_entry(entry_id):
    """Delete a specific history entry by ID"""
    global command_history
    original_length = len(command_history)
    command_history = [entry for entry in command_history if entry.get("id") != entry_id]
    
    if len(command_history) < original_length:
        save_history()
        return jsonify({"message": "Entry deleted"}), 200
    
    return jsonify({"error": "Entry not found"}), 404

@app.route('/api/search', methods=['GET'])
def search_history():
    """Search command history"""
    query = request.args.get('q', '')
    if not query:
        return jsonify({"error": "Search query is required"}), 400
    
    results = []
    for entry in command_history:
        if (query.lower() in entry.get("command", "").lower() or 
            query.lower() in entry.get("code", "").lower() or
            query.lower() in entry.get("explanation", "").lower()):
            results.append(entry)
    
    return jsonify({
        "query": query,
        "results": results,
        "count": len(results)
    }), 200

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Get usage statistics"""
    model_counts = {}
    config_counts = {}
    
    for entry in command_history:
        model = entry.get("model")
        config = entry.get("config")
        
        if model:
            model_counts[model] = model_counts.get(model, 0) + 1
        if config:
            config_counts[config] = config_counts.get(config, 0) + 1
    
    return jsonify({
        "total_commands": len(command_history),
        "models": model_counts,
        "configs": config_counts
    }), 200

# Health check endpoint for monitoring
@app.route('/api/health', methods=['GET'])
def health_check():
    """Simple health check endpoint"""
    return jsonify({"status": "healthy", "time": time.time()}), 200

@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Not found"}), 404

@app.errorhandler(500)
def server_error(error):
    app.logger.error(f"Server error: {str(error)}")
    return jsonify({"error": "Internal server error"}), 500

# Clean up resources on shutdown
def cleanup():
    app.logger.info("Shutting down worker threads...")
    for _ in worker_threads:
        request_queue.put(("STOP", None, None, None))
    
    for thread in worker_threads:
        thread.join(timeout=1)
    
    app.logger.info("Saving history...")
    save_history()

# Register cleanup function
app.teardown_appcontext(lambda exception: cleanup())

if __name__ == '__main__':
    app.logger.info(f"Starting server in {'debug' if app.config['DEBUG'] else 'production'} mode")
    app.run(debug=app.config['DEBUG'], host='0.0.0.0', port=int(os.getenv('PORT', 5000)))
