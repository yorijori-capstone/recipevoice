import argparse
import os

import uvicorn


def main():
    parser = argparse.ArgumentParser(description="Run the RecipeVoice DB service (FastAPI).")
    parser.add_argument("--host", type=str, default=os.environ.get("DBSERVER_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("DBSERVER_PORT", "8030")))
    parser.add_argument("--reload", action="store_true", help="Enable auto-reload (development only).")
    args = parser.parse_args()

    uvicorn.run(
        "dbserver.app:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        log_level="info",
    )


if __name__ == "__main__":
    main()
