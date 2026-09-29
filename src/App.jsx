import React, { useState, useEffect, useRef } from 'react';
import './App.scss';

const App = () => {
  const [idInstance, setIdInstance] = useState('');
  const [apiTokenInstance, setApiTokenInstance] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);

  const [phoneInput, setPhoneInput] = useState('');
  const [activePhone, setActivePhone] = useState('');
  const [chatList, setChatList] = useState([]);

  const [messages, setMessages] = useState({});
  const [messageText, setMessageText] = useState('');
  const [error, setError] = useState('');

  const chatEndRef = useRef(null);
  const pollingRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activePhone]);

  // 1. Авторизация (только idInstance и apiTokenInstance)
  const handleLogin = (e) => {
    e.preventDefault();
    setError('');

    if (!idInstance.trim() || !apiTokenInstance.trim()) {
      setError('Заполните данные для входа!');
      return;
    }

    setIsAuthorized(true);
  };

  const handleCreateChat = (e) => {
    e.preventDefault();
    const cleanedPhone = phoneInput.replace(/\D/g, '');

    if (!cleanedPhone) return;

    if (!chatList.includes(cleanedPhone)) {
      setChatList((prev) => [...prev, cleanedPhone]);
    }

    setActivePhone(cleanedPhone);
    setPhoneInput('');
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageText.trim() || !activePhone) return;

    setError('');
    const chatId = `${activePhone}@c.us`;
    const textToSend = messageText.trim();

    try {
      const response = await fetch(
        `https://api.green-api.com/waInstance${idInstance}/sendMessage/${apiTokenInstance}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatId: chatId,
            message: textToSend,
          }),
        }
      );

      if (response.ok) {
        const newMsg = {
          id: Date.now().toString(),
          text: textToSend,
          type: 'outgoing',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        setMessages((prev) => ({
          ...prev,
          [activePhone]: [...(prev[activePhone] || []), newMsg],
        }));

        setMessageText('');
      } else {
        const errorData = await response.json();
        setError(`Ошибка отправки: ${errorData.message || 'Проверьте данные доступа'}`);
      }
    } catch (err) {
      setError('Ошибка сети при отправке сообщения.');
      console.error(err);
    }
  };

  useEffect(() => {
    if (!isAuthorized) return;

    const receiveNotifications = async () => {
      try {
        const response = await fetch(
          `https://api.green-api.com/waInstance${idInstance}/receiveNotification/${apiTokenInstance}`
        );

        if (response.ok) {
          const data = await response.json();

          if (data && data.receiptId) {
            const { receiptId, body } = data;

            if (body.typeWebhook === 'incomingMessageReceived') {
              const senderChatId = body.senderData?.chatId || '';
              const senderPhone = senderChatId.replace('@c.us', '').replace(/\D/g, '');

              const incomingText =
                body.messageData?.textMessageData?.textMessage ||
                body.messageData?.extendedTextMessageData?.text ||
                '';

              if (incomingText && senderPhone) {
                setChatList((prev) => (prev.includes(senderPhone) ? prev : [...prev, senderPhone]));

                const newMsg = {
                  id: receiptId.toString(),
                  text: incomingText,
                  type: 'incoming',
                  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                };

                setMessages((prev) => ({
                  ...prev,
                  [senderPhone]: [...(prev[senderPhone] || []), newMsg],
                }));
              }
            }

            await fetch(
              `https://api.green-api.com/waInstance${idInstance}/deleteNotification/${apiTokenInstance}/${receiptId}`,
              { method: 'DELETE' }
            );
          }
        }
      } catch (err) {
        console.error('Ошибка при получении уведомлений:', err);
      } finally {
        pollingRef.current = setTimeout(receiveNotifications, 5000);
      }
    };

    receiveNotifications();

    return () => {
      if (pollingRef.current) clearTimeout(pollingRef.current);
    };
  }, [isAuthorized, idInstance, apiTokenInstance]);

  // Выход
  const handleLogout = () => {
    setIsAuthorized(false);
    setActivePhone('');
    setChatList([]);
    setMessages({});
    setError('');
  };

  const currentMessages = activePhone ? messages[activePhone] || [] : [];

  return (
    <div className="app-container">
      {!isAuthorized ? (
        <div className="login-wrapper">
          <form className="login-form" onSubmit={handleLogin}>
            <div className="logo">WhatsApp Web (GREEN-API)</div>
            <h2>Вход в систему</h2>

            {error && <div className="error-message">{error}</div>}

            <label htmlFor="idInstance">idInstance</label>
            <input
              id="idInstance"
              type="text"
              value={idInstance}
              onChange={(e) => setIdInstance(e.target.value)}
              required
            />

            <label htmlFor="apiTokenInstance">apiTokenInstance</label>
            <input
              id="apiTokenInstance"
              type="password"
              value={apiTokenInstance}
              onChange={(e) => setApiTokenInstance(e.target.value)}
              required
            />

            <button type="submit" className="login-btn">Войти</button>
          </form>
        </div>
      ) : (
        <div className="messenger-layout">
          <aside className="sidebar">
            <div className="sidebar-header">
              <div className="user-avatar">Me</div>
              <button className="logout-btn" onClick={handleLogout}>Выйти</button>
            </div>

            <div className="create-chat-box">
              <label htmlFor="newPhone">Новый чат (номер телефона)</label>
              <form onSubmit={handleCreateChat} className="create-chat-form">
                <input
                  id="newPhone"
                  type="tel"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  required
                />
                <button type="submit" className="add-chat-btn">Открыть чат</button>
              </form>
            </div>

            <div className="chat-list">
              {chatList.map((phone) => (
                <div
                  key={phone}
                  className={`chat-item ${phone === activePhone ? 'active' : ''}`}
                  onClick={() => setActivePhone(phone)}
                >
                  <div className="chat-avatar">WA</div>
                  <div className="chat-info">
                    <div className="chat-name">+{phone}</div>
                    <div className="chat-preview">Нажмите, чтобы открыть</div>
                  </div>
                </div>
              ))}
            </div>
          </aside>

          <main className="chat-area">
            {activePhone ? (
              <>
                <header className="chat-header">
                  <div className="chat-header-info">
                    <div className="chat-title">+{activePhone}</div>
                    <div className="chat-status">в сети через GREEN-API</div>
                  </div>
                </header>

                <div className="chat-history">
                  {error && <div className="error-banner">{error}</div>}

                  {currentMessages.length === 0 && !error && (
                    <div className="empty-history">
                      Сообщений пока нет. Напишите первое сообщение!
                    </div>
                  )}

                  {currentMessages.map((msg) => (
                    <div key={msg.id} className={`message-row ${msg.type}`}>
                      <div className="message-bubble">
                        <span className="message-text">{msg.text}</span>
                        <span className="message-time">{msg.time}</span>
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>

                <form className="chat-input-area" onSubmit={handleSendMessage}>
                  <input
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                  />
                  <button type="submit" className="send-btn" disabled={!messageText.trim()}>
                    ➤
                  </button>
                </form>
              </>
            ) : (
              <div className="no-chat-selected">
                Введите номер телефона в панели слева и нажмите «Открыть чат»
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  );
};

export default App;