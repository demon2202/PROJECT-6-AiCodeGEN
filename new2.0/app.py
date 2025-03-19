from flask import Flask, request, jsonify
import google.generativeai as genai
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configure the Google Gemini API
API_KEY = 'AIzaSyCUyQ0OMeqHftSBZnJzjF1HLHGtx7dejB0'  # Replace with your actual API key
genai.configure(api_key=API_KEY)

# Initialize the model
generation_config = {
    "temperature": 0.7,
    "top_p": 0.95,
    "top_k": 40,
    "max_output_tokens": 1024,
}
safety_settings = [
    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
]

model = genai.GenerativeModel(
    model_name="gemini-1.5-pro",
    generation_config=generation_config,
    safety_settings=safety_settings
)

# Initialize a simple in-memory history
command_history = []

def generate_code_snippet(command):
    """Generate code snippet based on the command using Google's Gemini API."""
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
            
            # Add to history (limit to 20 items)
            if len(command_history) >= 20:
                command_history.pop(0)
            command_history.append({"command": command, "code": code, "explanation": explanation})
            
            return code, explanation
        else:
            return "", "Failed to generate code snippet. Please try again."
    
    except Exception as e:
        print(f"Error generating code: {str(e)}")
        return "", f"Error: {str(e)}"

@app.route('/generate_code', methods=['POST'])
def generate_code():
    data = request.json
    command = data.get('command')

    if not command:
        return jsonify({"error": "Command is required"}), 400

    code, explanation = generate_code_snippet(command)
    
    if not code:
        return jsonify({"error": explanation}), 500

    return jsonify({"code": code, "explanation": explanation}), 200

@app.route('/history', methods=['GET'])
def get_history():
    return jsonify(command_history), 200

if __name__ == '__main__':
    app.run(debug=True)