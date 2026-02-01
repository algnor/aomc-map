from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict


AlreadyExists = {
    "description": "Already Exists",
    "content": {"application/json": {"message": "Already Exists"}},
}

BadRequest = {
    "description": "Bad or malformed request",
    "content": {"application/json": {"message": "Bad or malformed request"}},
}

ServerError = {
    "description": "Server Error",
    "content": {"application/json": {"message": "Server Error"}},
}