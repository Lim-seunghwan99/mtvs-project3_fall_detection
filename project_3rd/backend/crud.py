from sqlalchemy.orm import Session
from . import models, schemas
from datetime import datetime

def create_fall_event(db: Session, phone_number:str, fall_type:str , photo_data:bytes):
    db_fall_event = models.FallEvent(
        phone_number=phone_number,
        fall_type=fall_type,
        photo_filename=photo_data,  # 타임스탬프는 자동 생성
    )
    db.add(db_fall_event)
    db.commit()
    db.refresh(db_fall_event)
    return db_fall_event


def get_fall_event_by_phone_number(db: Session, phone_number: str):
    return db.query(models.FallEvent).filter(models.FallEvent.phone_number == phone_number).all()
