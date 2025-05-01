// src/components/PhoneNumberLogin/PhoneNumberLogin.jsx
import React, { useState, useCallback } from 'react';
import './PhoneNumberLogin.css'; 

function PhoneNumberLogin({ onLogin }) {
  const [inputPhoneNumber, setInputPhoneNumber] = useState('');

  const handleInputChange = (event) => {
    const formattedPhoneNumber = event.target.value.replace(/[^0-9-]/g, ''); 
    if (formattedPhoneNumber.length > 13) {
      alert('전화번호는 최대 13자리까지 입력 가능합니다.');
      return;
    }
    setInputPhoneNumber(formattedPhoneNumber);
  };

  const handleLoginClick = () => {
    if (inputPhoneNumber) {
      onLogin(inputPhoneNumber); 
    } else {
      alert('전화번호를 입력해주세요.');
    }
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter') {
      handleLoginClick();
    }
  };

  return (
    <div className="phone-login-container">
      <h3>전화번호 등록</h3>
      <p>기록이나 알림을 받을 전화번호를 입력하세요.</p>
      <div className="input-group">
        <input
          type="tel"
          id="phone-login-input"
          value={inputPhoneNumber}
          onChange={handleInputChange}
          onKeyUp={handleKeyPress}
          placeholder="-을 포함해서 입력 (예: 010-1234-5678)"
        />
        <button onClick={handleLoginClick} disabled={!inputPhoneNumber}>
          등록/확인
        </button>
      </div>
    </div>
  );
}

export default PhoneNumberLogin;