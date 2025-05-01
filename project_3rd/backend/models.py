from sqlalchemy import Column, Integer, String, text, LargeBinary, DateTime
from .database import Base
from sqlalchemy.sql import func

class FallEvent(Base):
    __tablename__ = "fall_events"
    id = Column(Integer, primary_key=True, index=True)
    phone_number = Column(String, index=True, nullable=False)
    fall_timestamp = Column(DateTime(timezone=True), server_default=func.now())
    fall_type = Column(String, nullable=False)
    # 낙상 사진
    photo_filename = Column(String, nullable=True)
