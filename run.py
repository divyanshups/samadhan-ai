"""Start Samadhan from this folder: python run.py"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "backend"))
if __name__ == "__main__":
    import uvicorn

    print("Samadhan AI: http://127.0.0.1:8000")
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000)
