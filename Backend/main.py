from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import google.generativeai as genai
import sys
import io

app = Flask(__name__, static_folder="../build", static_url_path="/")
CORS(app)

GEMINI_API_KEY = "api key here"  
genai.configure(api_key=GEMINI_API_KEY)

@app.route('/')
def serve():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/api/generate-code', methods=['POST'])
def generate_code():
    try:
        data = request.json
        instruction = data.get('instruction', '')
        previous_code = data.get('previousCode', '')

        if not instruction:
            return jsonify({"error": "Instruction is required"}), 400

        prompt = create_prompt(instruction, previous_code)
        response = generate_python_code(prompt)
        return jsonify({"code": response})

    except Exception as e:
        print(f"Error in /generate-code: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/run-code', methods=['POST'])
def run_code():
    try:
        data = request.json
        code = data.get('code', '')

        if not code:
            return jsonify({"error": "Code is required"}), 400

        old_stdout = sys.stdout
        redirected_output = io.StringIO()
        sys.stdout = redirected_output

        try:
            exec(code, globals())
            redirected_output.seek(0)
            result = redirected_output.read()
            if not result.strip():
                result = "Code executed successfully with no output."
        except Exception as e:
            result = f"Error executing code: {e}"

        sys.stdout = old_stdout
        return jsonify({"result": result})

    except Exception as e:
        print(f"Error in /run-code: {str(e)}")
        return jsonify({"error": str(e)}), 500

def create_prompt(instruction, previous_code):
    if previous_code:
        return f"""
You are a Python expert. Merge this instruction into the existing code.

Previous code:
{previous_code}

Instruction:
{instruction}

Return ONLY valid Python code (no markdown, no explanation).
"""
    else:
        return f"""
You are a Python expert. Write Python code for this instruction:

Instruction:
{instruction}

Return ONLY valid Python code (no markdown, no explanation).
"""

def generate_python_code(prompt):
    model = genai.GenerativeModel('gemini-1.5-pro')  # Make sure you have access to this model

    response = model.generate_content(
        prompt,
        generation_config={
            "temperature": 0.2,
            "top_p": 0.8,
            "top_k": 40,
            "max_output_tokens": 2048
        },
        safety_settings=[
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"}
        ]
    )

    code = response.text.strip()
    if "```" in code:
        code = code.split("```")[1].replace("python", "").strip()
    return code

if __name__ == '__main__':
    app.run(debug=True, port=5000)
