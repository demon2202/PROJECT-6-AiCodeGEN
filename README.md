# Python Code Generator
# IMAGES
![image](https://github.com/user-attachments/assets/b7b81d2d-3b5b-4124-8595-21785abadf25)
![image](https://github.com/user-attachments/assets/4b339fea-82ec-495b-90a3-c51ee231a0d2)
![image](https://github.com/user-attachments/assets/37056703-4fc8-4d7f-8636-50b66292bded)

## Table of Contents
1. [Project Overview](#project-overview)
2. [Features](#features)
3. [Technical Architecture](#technical-architecture)
4. [Prerequisites](#prerequisites)
5. [Installation Guide](#installation-guide)
   - [Backend Setup](#backend-setup)
   - [Frontend Setup](#frontend-setup)
6. [Configuration](#configuration)
7. [Using the Application](#using-the-application)
8. [API Reference](#api-reference)
9. [Understanding the Code](#understanding-the-code)
10. [Troubleshooting](#troubleshooting)
11. [Security Considerations](#security-considerations)
12. [Future Enhancements](#future-enhancements)
13. [FAQ](#faq)


## Project Overview

This project is a web-based application that allows users to generate Python code snippets using natural language commands. The application uses Google's Gemini AI to interpret user commands and generate appropriate Python code, making programming more accessible to people without extensive coding experience.

**Example**: A user can type "create a function to find prime numbers up to 100" and receive working Python code that accomplishes this task, along with an explanation of how the code works.

## Features

- **Natural Language to Code Conversion**: Transform plain English commands into functional Python code
- **Code Explanations**: Receive explanations for each generated code snippet
- **Command History**: Access your previously generated code snippets
- **User-Friendly Interface**: Simple, intuitive design for users of all technical levels
- **Real-time Response**: Quick generation of code snippets

## Technical Architecture

The application follows a client-server architecture:

1. **Frontend**: Built with React.js
   - User interface for entering commands
   - Display area for generated code and explanations
   - History section for previous commands

2. **Backend**: Built with Flask (Python)
   - REST API to handle requests from the frontend
   - Integration with Google's Gemini AI API
   - In-memory storage for command history

3. **External Services**:
   - Google Gemini API: Provides the AI capabilities for code generation

## Prerequisites

Before setting up the project, ensure you have the following:

- **Python**: Version 3.8 or higher
- **Node.js**: Version 14 or higher
- **npm**: Usually comes with Node.js
- **Google Gemini API Key**: Required for AI functionality
- **Git**: For cloning the repository (optional)
- **Web Browser**: Modern browser like Chrome, Firefox, or Edge

## Installation Guide

### Backend Setup

1. **Clone the repository** (if you haven't already):
   ```bash
   git clone PROJECT-6-AutoCodex
   cd PROJECT-6-AutoCodex
   ```

2. **Create a Python virtual environment**:
   ```bash
   # Navigate to the backend directory
   cd Backend
   
   # Create virtual environment
   python -m venv venv
   
   # Activate virtual environment (Windows)
   venv\Scripts\activate
   
   # Activate virtual environment (macOS/Linux)
   source venv/bin/activate
   ```

3. **Install required Python packages**:
   ```bash
   pip install flask google-generativeai flask-cors
   ```

4. **Obtain a Google Gemini API key**:
   - Visit [Google AI Studio](https://ai.google.dev/)
   - Create an account or sign in
   - Navigate to the API section
   - Create a new API key
   - Copy the key for later use

5. **Configure the API key**:
   - Open `Backend/main.py` in a text editor
   - Locate the line: `API_KEY = ' Replace with your actual API key'`
   - Replace the placeholder with your actual API key:
     ```python
     API_KEY = 'your-actual-api-key-here'
     ```

6. **Start the backend server**:
   ```bash
   python main.py
   ```
   The server will start and be available at `http://localhost:5000`

### Frontend Setup

1. **Navigate to the project root directory** (containing the `src` folder):
   ```bash
   # If you're in the Backend directory
   cd ..
   ```

2. **Install Node.js dependencies**:
   ```bash
   npm install
   ```

3. **Start the React development server**:
   ```bash
   npm start
   ```
   The frontend will be available at `http://localhost:3000`

## Configuration

### Backend Configuration Options

The backend can be configured by modifying the following parameters in `main.py`:

- **API Key**: Replace the placeholder with your actual Google Gemini API key
- **Temperature**: Controls the randomness of responses (0.7 by default)
- **Max Output Tokens**: Limits the length of generated code (1024 by default)
- **Safety Settings**: Controls what types of content are filtered out

```python
generation_config = {
    "temperature": 0.7,        # Adjust for more/less creative outputs
    "top_p": 0.95,             # Sampling threshold
    "top_k": 40,               # Number of tokens to consider
    "max_output_tokens": 1024, # Maximum length of output
}
```

### Frontend Configuration

The frontend can be configured by modifying the React files in the `src` directory:

- **App.js**: Main component logic
- **App.css**: Styling for the application
- **index.js**: Entry point for the React application

## Using the Application

1. **Access the application**:
   - Open your web browser
   - Navigate to `http://localhost:3000`

2. **Generate code**:
   - Type a command in the input field (e.g., "Create a function to calculate the factorial of a number")
   - Click the "Generate" button or press Enter
   - Wait for the response (usually takes 2-5 seconds)

3. **View results**:
   - The generated code will appear in the code display area
   - An explanation of the code will be shown below it

4. **Use the command history**:
   - Scroll down to see your previous commands
   - Click on a previous command to view its code and explanation again

5. **Example commands you can try**:
   - "Create a function to check if a number is prime"
   - "Write code to download data from a URL"
   - "Generate a class for a simple banking system"
   - "Create a script to read and analyze CSV data"
   - "Write a function to find the longest word in a sentence"

## API Reference

The backend exposes the following REST API endpoints:

### Generate Code

- **URL**: `/generate_code`
- **Method**: `POST`
- **Request Body**:
  ```json
  {
    "command": "Your natural language command here"
  }
  ```
- **Response**:
  ```json
  {
    "code": "Generated Python code",
    "explanation": "Explanation of the code"
  }
  ```
- **Error Response**:
  ```json
  {
    "error": "Error message"
  }
  ```

### Get Command History

- **URL**: `/history`
- **Method**: `GET`
- **Response**:
  ```json
  [
    {
      "command": "Previous command",
      "code": "Generated code",
      "explanation": "Explanation"
    },
    // More history items...
  ]
  ```

## Understanding the Code

### Backend Code Explanation

The backend (`main.py`) has several key components:

1. **Flask Application Setup**:
   ```python
   app = Flask(__name__)
   CORS(app)  # Enable Cross-Origin Resource Sharing
   ```
   This creates a web server and allows the frontend to communicate with it.

2. **Google Gemini API Configuration**:
   ```python
   genai.configure(api_key=API_KEY)
   model = genai.GenerativeModel(...)
   ```
   This sets up the connection to Google's AI service.

3. **Code Generation Function**:
   ```python
   def generate_code_snippet(command):
       # Function logic here
   ```
   This function takes a user command, sends it to the Gemini API, and processes the response.

4. **API Endpoints**:
   ```python
   @app.route('/generate_code', methods=['POST'])
   def generate_code():
       # Endpoint logic here
   
   @app.route('/history', methods=['GET'])
   def get_history():
       # Endpoint logic here
   ```
   These define the web endpoints that the frontend can call.

### Frontend Code Explanation

The frontend uses React and consists of several key files:

1. **App.js**: The main component that handles:
   - User input
   - API calls to the backend
   - Displaying results

2. **index.js**: The entry point that renders the App component

3. **App.css**: Contains styling for the application

## Troubleshooting

### Common Issues and Solutions

1. **Backend won't start**:
   - Ensure Python 3.8+ is installed: `python --version`
   - Check that all required packages are installed: `pip list`
   - Verify the API key is correctly configured
   - Make sure port 5000 is not in use by another application

2. **Frontend won't start**:
   - Ensure Node.js is installed: `node --version`
   - Check that npm dependencies are installed: `npm list`
   - Make sure port 3000 is not in use by another application

3. **Connection errors**:
   - Verify both backend and frontend are running
   - Check that the backend URL is correct in the frontend code
   - Ensure your firewall isn't blocking the connections

4. **API errors**:
   - Verify your Google Gemini API key is valid and active
   - Check that you haven't exceeded API usage limits
   - Ensure your network can reach Google's servers

5. **Code generation issues**:
   - Try rephrasing your command to be more specific
   - Check if the command is too complex or ambiguous
   - Ensure the command is related to Python programming

## Security Considerations

1. **API Key Protection**:
   - Never commit your API key to version control
   - Consider using environment variables instead of hardcoding
   - Implement proper access controls for production environments

2. **Input Validation**:
   - The application should validate and sanitize user inputs
   - Implement rate limiting to prevent abuse

3. **Code Execution**:
   - Generated code should be reviewed before execution
   - Never automatically execute generated code in sensitive environments

4. **Data Privacy**:
   - Be aware that commands sent to the Gemini API may be stored by Google
   - Avoid sending sensitive information in your commands

## Future Enhancements

Potential improvements for the project:

1. **User Authentication**: Add login functionality to save user-specific history
2. **Code Execution**: Add the ability to execute generated code in a sandbox environment
3. **Multiple Language Support**: Extend beyond Python to other programming languages
4. **Advanced Prompting**: Allow users to specify more details about desired code
5. **Export Functionality**: Add options to export code to files or share via link
6. **Responsive Design**: Improve mobile and tablet support
7. **Offline Mode**: Add capability to work with limited functionality when offline
8. **Code Snippets Library**: Create a searchable library of common code snippets

## FAQ

**Q: Do I need programming experience to use this application?**
A: No, the application is designed to be usable by people with minimal programming experience. You just need to describe what you want the code to do in plain English.

**Q: Is there a limit to how many code snippets I can generate?**
A: The Google Gemini API may have usage limits based on your account type. Check the [Google AI Studio](https://ai.google.dev/) for information about your specific limits.

**Q: Can I use the generated code in my projects?**
A: Yes, but always review the code first to ensure it meets your requirements and doesn't contain errors or security issues.

**Q: Does the application store my commands or code?**
A: The application stores your recent commands and generated code in memory for the command history feature. This data is not persistent and will be lost when the server restarts.

**Q: Can I suggest improvements or report bugs?**
A: Yes, please submit issues or feature requests through the project's issue tracker on GitHub.

---

*This project uses the Google Gemini API, which may have separate terms of service. Please review Google's terms before using this application.*
