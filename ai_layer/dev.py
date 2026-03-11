import subprocess

print("Building vector index...")
subprocess.run(["python", "rag/build_index.py"])

print("Starting AI server...")
subprocess.run(["uvicorn", "app:app", "--reload", "--port", "9000"])