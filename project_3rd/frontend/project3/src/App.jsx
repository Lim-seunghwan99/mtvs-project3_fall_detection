// src/App.jsx
import React, { useState, useCallback, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import NavigationBar from './components/NavigationBar/NavigationBar';
import RealTimePage from './pages/RealTimePage';
import HistoryLookupPage from './pages/HistoryLookupPage';
import PhoneNumberLogin from './components/PhoneNumberLogin/PhoneNumberLogin'; 
import './App.css';

const PHONE_NUMBER_SESSION_KEY = 'sessionLoggedInPhoneNumber'; 

function App() {
  const [loggedInPhoneNumber, setLoggedInPhoneNumber] = useState(() => {
    const storedPhoneNumber = sessionStorage.getItem(PHONE_NUMBER_SESSION_KEY);
    console.log("App: Retrieved phone number from localStorage:", storedPhoneNumber);
    return storedPhoneNumber ? storedPhoneNumber : null; 
  }); 

  const handleLogin = useCallback((phoneNumber) => {
    console.log("App: Phone number logged in:", phoneNumber);
    try {
      // 전화번호를 세션 스토리지에 저장
      sessionStorage.setItem(PHONE_NUMBER_SESSION_KEY, phoneNumber);
      console.log("App: Phone number saved to localStorage:", phoneNumber);

      setLoggedInPhoneNumber(phoneNumber);
      console.log("App: Phone number state updated:", phoneNumber);
    } catch (error) {
      console.error("App: Error saving phone number to localStorage:", error);
      alert("전화번호 저장 중 오류가 발생했습니다.");
    }
  }, []);

  const handleLogout = useCallback(() => {
    console.log("App: Logging out.");
    sessionStorage.removeItem(PHONE_NUMBER_SESSION_KEY);
    setLoggedInPhoneNumber(null);
  }, []);

  return (
    <BrowserRouter>
      <div className="App">
        <header className="App-header">
          <div className="header-content">
            <h1>실시간 낙상 감지 시스템 (피우다)</h1>
            {loggedInPhoneNumber && (
              <button onClick={handleLogout} className="logout-button">
                로그아웃 ({loggedInPhoneNumber})
              </button>
            )}
          </div>
        </header>
        <NavigationBar />
        <main className="App-main">
          <Routes>
            <Route path="/" element={<RealTimePage loggedInPhoneNumber={loggedInPhoneNumber} />} />
            <Route
              path="/lookup"
              element={
                loggedInPhoneNumber ? (
                  <HistoryLookupPage phoneNumber={loggedInPhoneNumber} />
                ) : (
                  <>
                    <PhoneNumberLogin onLogin={handleLogin} />
                  </>
                )
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} /> 
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;