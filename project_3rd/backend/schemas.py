from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

class FallEventBase(BaseModel):
    phone_number: str
    fall_type: str


class FallEventCreate(FallEventBase):
    pass


class FallEventResponse(BaseModel):
    id: int
    phone_number: str
    fall_type: str
    fall_timestamp: datetime
    photo_filename: str

    class Config:
        from_attributes = True


class SMSRequest(BaseModel):
    to_number : str
    text: str = Field(..., min_length=1, max_length=90, description="문자 메시지 예시")
