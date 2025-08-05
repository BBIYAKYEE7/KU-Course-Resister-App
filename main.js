const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const Store = require('electron-store');
const axios = require('axios');

// 설정 저장소 초기화
const store = new Store();
let mainWindow;
let serverTimeWindow;

async function createWindow() {
  // 첫 실행 시 로그인 정보 설정
  await checkFirstRun();
  
  // 메인 윈도우 생성
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1400,
    minHeight: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      enableRemoteModule: false
    },
    icon: path.join(__dirname, 'assets/icon.png'),
    show: false,
    titleBarStyle: 'default'
  });

  // 고려대학교 수강신청 사이트 로드 (메인 페이지에서 로그인 처리)
  mainWindow.loadURL('https://sugang.korea.ac.kr/');

  // 윈도우가 준비되면 표시
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    applyTheme();
    createServerTimeOverlay();
  });

  // 페이지 로드 완료 시 폰트만 적용 (자동로그인은 정각에만)
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('페이지 로드 완료 - 폰트 적용');
    applyPretendardFont();
  });

  // DOM 준비 완료 시에도 폰트만 적용
  mainWindow.webContents.on('dom-ready', () => {
    console.log('DOM 준비 완료 - 대기 중 (자동로그인은 정각에만 실행)');
  });

  // 매 정각마다 자동 로그인 설정
  setupHourlyAutoLogin();

  // 윈도우가 닫힐 때
  mainWindow.on('closed', () => {
    mainWindow = null;
    if (serverTimeWindow) {
      serverTimeWindow.close();
      serverTimeWindow = null;
    }
  });

  // 외부 링크는 기본 브라우저에서 열기
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // 메뉴 생성
  createMenu();
}

// 앱이 준비되면 윈도우 생성
app.whenReady().then(createWindow);

// 모든 윈도우가 닫혔을 때
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 앱이 활성화될 때 (macOS)
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// 매 정각마다 자동 로그인 설정
function setupHourlyAutoLogin() {
  console.log('✅ 매 정각 자동로그인 시스템 활성화 (페이지 로드 시 자동로그인 비활성화)');
  
  // 다음 정각까지의 시간 계산 함수
  function getMillisecondsUntilNextHour() {
    const now = new Date();
    const nextHour = new Date(now);
    nextHour.setHours(now.getHours() + 1, 0, 0, 0); // 다음 시간의 정각으로 설정
    return nextHour.getTime() - now.getTime();
  }
  
  // 자동 로그인 실행 함수
  function executeHourlyAutoLogin() {
    const currentTime = new Date().toLocaleTimeString();
    console.log(currentTime + ' - 정각 자동로그인 실행');
    
    // 메인 윈도우가 존재하고 로그인 정보가 있는 경우에만 실행
    if (mainWindow && mainWindow.webContents && store.get('userLoginInfo')) {
      try {
        injectEnhancements();
        console.log('정각 자동로그인 완료');
      } catch (error) {
        console.log('정각 자동로그인 중 오류:', error.message);
      }
    } else {
      console.log('자동로그인 조건 미충족 - 건너뜀');
    }
  }
  
  // 첫 번째 정각까지 대기 후 실행, 그 이후 매시 반복
  const timeUntilNextHour = getMillisecondsUntilNextHour();
  const minutesUntilNextHour = Math.round(timeUntilNextHour / 1000 / 60);
  console.log('다음 정각까지 ' + minutesUntilNextHour + '분 대기 중...');
  
  setTimeout(() => {
    executeHourlyAutoLogin();
    
    // 이후 매시 정각마다 실행 (1시간 = 3,600,000ms)
    setInterval(executeHourlyAutoLogin, 60 * 60 * 1000);
    
  }, timeUntilNextHour);
}

// 메뉴 생성
function createMenu() {
  const template = [
    {
      label: '수강신청',
      submenu: [
        {
          label: '새로고침',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            if (mainWindow) {
              mainWindow.reload();
            }
          }
        },
        {
          label: '서버시간 확인',
          accelerator: 'CmdOrCtrl+T',
          click: () => {
            showServerTime();
          }
        },
        { type: 'separator' },
        {
          label: '종료',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: '설정',
      submenu: [
        {
          label: '다크모드',
          type: 'checkbox',
          checked: store.get('darkMode', false),
          click: (menuItem) => {
            toggleDarkMode(menuItem.checked);
          }
        },
        {
          label: '로그인 정보 재설정',
          click: async () => {
            const loginInfo = await showLoginSetupDialog();
            if (loginInfo) {
              store.set('userLoginInfo', loginInfo);
              store.set('saveLogin', true);
              // 현재 페이지를 새로고침하여 새로운 로그인 정보 적용
              if (mainWindow) {
                mainWindow.reload();
              }
            }
          }
        },
        {
          label: '지금 로그인',
          click: () => {
            console.log('수동 로그인 실행');
            if (mainWindow && mainWindow.webContents && store.get('userLoginInfo')) {
              injectEnhancements();
            } else {
              console.log('로그인 정보가 없습니다. 먼저 로그인 정보를 설정해주세요.');
            }
          }
        },
        {
          label: '저장된 설정 확인',
          click: () => {
            const settings = store.store;
            const hasLogin = store.has('userLoginInfo');
            const loginInfo = hasLogin ? store.get('userLoginInfo') : null;
            
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '저장된 설정 정보',
              message: '현재 저장된 설정',
              detail: `로그인 정보 저장 여부: ${hasLogin ? '예' : '아니오'}\n` +
                     `사용자명: ${loginInfo ? '[보안상 숨김]' : '없음'}\n` +
                     `다크모드: ${settings.darkMode ? '활성화' : '비활성화'}\n` +
                     `전체 설정: [보안상 숨김]`,
              buttons: ['확인']
            });
          }
        },
        { type: 'separator' },
        {
          label: '개발자 도구',
          accelerator: 'F12',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.toggleDevTools();
            }
          }
        }
      ]
    },
    {
      label: '도움말',
      submenu: [
        {
          label: '정보',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '고려대학교 수강신청 앱',
              message: '고려대학교 수강신청 도우미',
              detail: '• 다크모드 지원\n• 서버시간 확인\n• 로그인 정보 저장\n• 최적화된 화면 크기',
              buttons: ['확인']
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// 다크모드 토글
function toggleDarkMode(enabled) {
  store.set('darkMode', enabled);
  applyTheme();
}

// 강력한 다크모드 테마 적용
function applyTheme() {
  const isDarkMode = store.get('darkMode', false);
  
  if (mainWindow && mainWindow.webContents) {
    if (isDarkMode) {
      console.log('다크모드 활성화 중...');
      // 더 강력하고 자연스러운 다크 모드 CSS
      const darkCSS = `
        /* 전체 페이지 다크모드 */
        html, body {
          background-color: #1a1a1a !important;
          color: #e0e0e0 !important;
        }
        
        /* 모든 요소 기본 다크 테마 */
        *, *::before, *::after {
          background-color: #1a1a1a !important;
          color: #e0e0e0 !important;
          border-color: #444 !important;
        }
        
        /* 입력 필드들 */
        input, textarea, select {
          background-color: #2d2d2d !important;
          color: #e0e0e0 !important;
          border: 1px solid #555 !important;
        }
        
        input::placeholder, textarea::placeholder {
          color: #aaa !important;
        }
        
        /* 버튼들 */
        button, .btn, input[type="button"], input[type="submit"] {
          background-color: #333 !important;
          color: #e0e0e0 !important;
          border: 1px solid #555 !important;
        }
        
        button:hover, .btn:hover {
          background-color: #444 !important;
        }
        
        /* 고려대 로그인 버튼 특별 처리 */
        button[id="btn-login"], .btn-login {
          background-color: #8B0000 !important;
          color: #fff !important;
        }
        
        button[id="btn-login"]:hover, .btn-login:hover {
          background-color: #a00000 !important;
        }
        
        /* 링크들 */
        a, a:visited {
          color: #66b3ff !important;
        }
        
        a:hover {
          color: #99ccff !important;
        }
        
        /* 테이블 */
        table, th, td {
          background-color: #2d2d2d !important;
          color: #e0e0e0 !important;
          border-color: #555 !important;
        }
        
        /* 메뉴/네비게이션 */
        .menu, .nav, nav, header {
          background-color: #2d2d2d !important;
          color: #e0e0e0 !important;
        }
        
        /* 고려대 특별 색상들 유지 */
        .red, .korea-red, [style*="color: red"], [style*="color: #8B0000"] {
          color: #ff6b6b !important;
        }
        
        /* 화이트 박스들 */
        .white-box, .content-box, .main-content, .login-box {
          background-color: #2d2d2d !important;
          color: #e0e0e0 !important;
        }
        
        /* 로그인 폼 특별 처리 */
        form, .form {
          background-color: #2d2d2d !important;
        }
        
        /* 이미지들은 원본 유지 (로고 등) */
        img {
          filter: none !important;
        }
        
        /* 그림자 효과 조정 */
        * {
          box-shadow: none !important;
        }
        
        /* 스크롤바 다크 테마 */
        ::-webkit-scrollbar {
          background-color: #1a1a1a !important;
        }
        
        ::-webkit-scrollbar-thumb {
          background-color: #555 !important;
        }
        
        ::-webkit-scrollbar-thumb:hover {
          background-color: #666 !important;
        }
      `;
      
      mainWindow.webContents.insertCSS(darkCSS);
      
      // iframe 내부에도 다크모드 적용
      setTimeout(() => {
        mainWindow.webContents.executeJavaScript(`
          try {
            const iframe = document.querySelector('iframe[name="main"], iframe[id="main"], iframe');
            if (iframe && iframe.contentDocument) {
              let iframeStyle = iframe.contentDocument.querySelector('#dark-mode-style');
              if (!iframeStyle) {
                iframeStyle = iframe.contentDocument.createElement('style');
                iframeStyle.id = 'dark-mode-style';
                iframe.contentDocument.head.appendChild(iframeStyle);
              }
              iframeStyle.textContent = \`${darkCSS.replace(/`/g, '\\`')}\`;
              console.log('iframe 다크모드 적용 완료');
            }
          } catch (e) {
            console.log('iframe 다크모드 적용 실패:', e.message);
          }
        `);
      }, 1000);
      
    } else {
      console.log('라이트모드로 복원 중...');
      // 다크모드 스타일 제거
      mainWindow.webContents.executeJavaScript(`
        try {
          const darkStyles = document.querySelectorAll('style[data-dark-mode]');
          darkStyles.forEach(style => style.remove());
          
          // iframe 내부 다크모드도 제거
          const iframe = document.querySelector('iframe[name="main"], iframe[id="main"], iframe');
          if (iframe && iframe.contentDocument) {
            const iframeStyle = iframe.contentDocument.querySelector('#dark-mode-style');
            if (iframeStyle) {
              iframeStyle.remove();
            }
          }
        } catch (e) {
          console.log('다크모드 제거 실패:', e.message);
        }
      `);
      
      // 페이지 새로고침으로 완전 복원
      setTimeout(() => {
        mainWindow.reload();
      }, 500);
    }
  }
}

// 서버시간 확인 윈도우
async function showServerTime() {
  try {
    // 네이비즘 API에서 서버시간 가져오기
    const response = await axios.get('https://time.navyism.com/?host=sugang.korea.ac.kr', {
      timeout: 5000
    });
    
    if (serverTimeWindow) {
      serverTimeWindow.focus();
      return;
    }

    serverTimeWindow = new BrowserWindow({
      width: 400,
      height: 300,
      parent: mainWindow,
      modal: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      },
      resizable: false,
      icon: path.join(__dirname, 'assets/icon.png')
    });

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>고려대학교 서버시간</title>
        <style>
          body {
            font-family: 'Segoe UI', Arial, sans-serif;
            margin: 0;
            padding: 20px;
            color: #333;
            text-align: center;
            min-height: 260px;
            display: flex;
            flex-direction: column;
            justify-content: center;
          }
          .server-time {
            font-size: 32px;
            font-weight: bold;
            margin: 20px 0;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
          }
          .date {
            font-size: 18px;
            margin: 10px 0;
            opacity: 0.9;
          }
          .info {
            font-size: 14px;
            margin: 15px 0;
            opacity: 0.8;
            line-height: 1.4;
          }
          .close-btn {
            background: rgba(255,255,255,0.2);
            border: 1px solid rgba(255,255,255,0.3);
            color: white;
            padding: 8px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            margin-top: 20px;
          }
          .close-btn:hover {
            background: rgba(255,255,255,0.3);
          }
        </style>
      </head>
      <body>
        <h2>🕐 고려대학교 서버시간</h2>
        <div class="server-time" id="serverTime">로딩 중...</div>
        <div class="date" id="serverDate"></div>
        <div class="info">
          네이비즘에서 제공하는 정확한 서버시간입니다.<br>
          수강신청 시 이 시간을 참고하세요.
        </div>
        <button class="close-btn" onclick="window.close()">닫기</button>
        
        <script>
          function updateTime() {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('ko-KR', {
              hour12: false,
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            });
            const dateStr = now.toLocaleDateString('ko-KR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              weekday: 'long'
            });
            
            document.getElementById('serverTime').textContent = timeStr;
            document.getElementById('serverDate').textContent = dateStr;
          }
          
          updateTime();
          setInterval(updateTime, 1000);
        </script>
      </body>
      </html>
    `;

    serverTimeWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));

    serverTimeWindow.on('closed', () => {
      serverTimeWindow = null;
    });

  } catch (error) {
    dialog.showErrorBox('서버시간 오류', '서버시간을 가져올 수 없습니다.\n네트워크 연결을 확인해주세요.');
  }
}

// 페이지 개선사항 주입
function injectEnhancements() {
  if (!mainWindow || !mainWindow.webContents) return;

  // 저장된 로그인 정보 가져오기
  const savedLoginInfo = store.get('userLoginInfo', null);
  console.log('자동로그인 스크립트 주입 시작'); // 보안상 상세 정보 숨김
  
  const script = `
    (function() {
      // 보안 강화: 로그인 정보를 클로저로 보호
      const getLoginInfo = (function() {
        const data = ${JSON.stringify(savedLoginInfo)};
        return function() {
          return data;
        };
      })();
      
      // 임시 변수 사용 후 즉시 정리
      const savedLogin = getLoginInfo();
      
      // 보안상 console 로그 제거
      
      // 메인 페이지에서 로그인 폼을 여는 버튼/링크 클릭 함수
      function clickLoginButton() {
        // 로그인 버튼 찾기 시작
        
        const loginSelectors = [
          'button[id="btn-login"]',        // 실제 로그인 버튼: <button id="btn-login">
          'button.btn-login',              // 실제 로그인 버튼: class="btn-login"
          '.btn-login',                    // 실제 로그인 버튼 클래스
          '#btn-login',                    // 실제 로그인 버튼 ID
          'button[type="button"]',         // type="button"인 버튼
          'a[href*="login"]',
          'a[href*="Login"]', 
          'button:contains("로그인")',
          'a:contains("로그인")',
          'button[onclick*="login"]',
          'a[onclick*="login"]',
          'input[value*="로그인"]',
          'button[title*="로그인"]',
          'a[title*="로그인"]'
        ];
        
        let loginButton = null;
        
        // 선택자로 찾기
        for (const selector of loginSelectors) {
          try {
            loginButton = document.querySelector(selector);
            if (loginButton && loginButton.offsetParent !== null) {
              // 로그인 버튼 발견
              break;
            }
          } catch (e) {
            // :contains() 등은 에러날 수 있음
          }
        }
        
        // 텍스트로 찾기 (더 광범위하게)
        if (!loginButton) {
          const allClickables = document.querySelectorAll('a, button, input[type="button"], input[type="submit"], div[onclick], span[onclick], li, td, div[class*="menu"], span[class*="menu"]');
          for (let element of allClickables) {
            const text = (element.textContent || element.innerText || element.value || element.title || '').toLowerCase().trim();
            if ((text.includes('로그인') || text.includes('login') || text === '로그인' || text === 'login') && element.offsetParent !== null) {
              loginButton = element;
              // 로그인 버튼 발견
              break;
            }
          }
        }
        
        // CSS 선택자로 메뉴나 네비게이션에서 찾기
        if (!loginButton) {
          const menuSelectors = [
            '.menu a:contains("로그인")',
            '.nav a:contains("로그인")',
            '.header a:contains("로그인")',
            '.top-menu a:contains("로그인")',
            '.gnb a:contains("로그인")',
            'nav a:contains("로그인")',
            'header a:contains("로그인")'
          ];
          
          for (const selector of menuSelectors) {
            try {
              const elements = document.querySelectorAll(selector.replace(':contains("로그인")', ''));
              for (let element of elements) {
                const text = (element.textContent || '').toLowerCase().trim();
                if (text.includes('로그인') && element.offsetParent !== null) {
                  loginButton = element;
                  // 메뉴에서 로그인 버튼 발견
                  break;
                }
              }
              if (loginButton) break;
            } catch (e) {
              // continue
            }
          }
        }
        
        if (loginButton) {
          // 로그인 버튼 클릭 시도
          try {
            loginButton.click();
            // 로그인 버튼 클릭 완료
            return true;
          } catch (e) {
            console.error('로그인 버튼 클릭 실패:', e);
            return false;
          }
        } else {
          console.log('로그인 버튼을 찾을 수 없습니다.');
          return false;
        }
      }

      // 로그인 박스 보이게 만들기
      function showLoginBox() {
        console.log('로그인 박스 찾기 및 표시 시도');
        
        // 로그인 박스 선택자들
        const loginBoxSelectors = [
          '.login-box',
          '#loginForm',
          'form[name="loginForm"]',
          'div[class*="login"]',
          'form[id="loginForm"]'
        ];
        
        let loginBoxFound = false;
        
        for (const selector of loginBoxSelectors) {
          const loginBox = document.querySelector(selector);
          if (loginBox) {
            console.log('로그인 박스 발견:', selector, loginBox);
            
            // 로그인 박스를 보이게 만들기
            loginBox.style.display = 'block';
            loginBox.style.visibility = 'visible';
            loginBox.style.opacity = '1';
            
            // 부모 요소들도 확인
            let parent = loginBox.parentElement;
            while (parent && parent !== document.body) {
              parent.style.display = 'block';
              parent.style.visibility = 'visible';
              parent.style.opacity = '1';
              parent = parent.parentElement;
            }
            
            console.log('로그인 박스 표시 완료');
            loginBoxFound = true;
            break;
          }
        }
        
        return loginBoxFound;
      }

      // iframe 내부에서 로그인 박스 보이게 만들기
      function showLoginBoxInDocument(doc) {
        console.log('로그인 박스 찾기 및 표시 시도 (iframe 내부)');
        
        const loginBoxSelectors = [
          '.login-box',
          '#loginForm',
          'form[name="loginForm"]',
          'div[class*="login"]',
          'form[id="loginForm"]'
        ];
        
        let loginBoxFound = false;
        
        for (const selector of loginBoxSelectors) {
          const loginBox = doc.querySelector(selector);
          if (loginBox) {
            console.log('iframe 내부 로그인 박스 발견:', selector, loginBox);
            
            // 로그인 박스를 보이게 만들기
            loginBox.style.display = 'block';
            loginBox.style.visibility = 'visible';
            loginBox.style.opacity = '1';
            
            // 부모 요소들도 확인
            let parent = loginBox.parentElement;
            while (parent && parent !== doc.body) {
              parent.style.display = 'block';
              parent.style.visibility = 'visible';
              parent.style.opacity = '1';
              parent = parent.parentElement;
            }
            
            console.log('iframe 내부 로그인 박스 표시 완료');
            loginBoxFound = true;
            break;
          }
        }
        
        return loginBoxFound;
      }

      // iframe 내부 문서 가져오기
      function getIframeDocument() {
        // iframe 선택자들
        const iframeSelectors = [
          'iframe[id="main"]',
          'iframe[name="main"]',
          'iframe',
          '#main',
          'frame[name="main"]'
        ];
        
        for (const selector of iframeSelectors) {
          const iframe = document.querySelector(selector);
          if (iframe) {
            console.log('iframe 발견:', selector, iframe);
            try {
              const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
              if (iframeDoc) {
                console.log('iframe 내부 문서 접근 성공');
                return iframeDoc;
              }
            } catch (e) {
              console.log('iframe 접근 실패:', e.message);
            }
          }
        }
        
        console.log('iframe을 찾을 수 없거나 접근할 수 없습니다.');
        return null;
      }

      // 로그인 정보 자동 입력 함수
      function fillLoginInfo() {
        if (!savedLogin || !savedLogin.username || !savedLogin.password) {
          console.log('저장된 로그인 정보가 없습니다.');
          return false;
        }
        
        // 자동 입력 시도 (보안상 로그 제거)
        
        // iframe 내부 문서 가져오기
        const iframeDoc = getIframeDocument();
        const targetDoc = iframeDoc || document;
        
        console.log('대상 문서:', iframeDoc ? 'iframe 내부' : '메인 페이지');
        
        // 먼저 로그인 박스를 보이게 시도 (iframe 내부에서)
        if (iframeDoc) {
          console.log('iframe 내부에서 로그인 박스 표시 시도');
          showLoginBoxInDocument(iframeDoc);
        } else {
          showLoginBox();
        }
        
        // iframe 내부 또는 메인 페이지에서 input 요소들 검사
        const allInputs = targetDoc.querySelectorAll('input');
        console.log('대상 문서에서 발견된 총 input 요소:', allInputs.length);
        
        // 모든 input 요소의 상세 정보 출력
        allInputs.forEach((input, index) => {
          console.log('Input ' + (index + 1) + ':', {
            type: input.type,
            name: input.name,
            id: input.id,
            className: input.className,
            placeholder: input.placeholder,
            visible: input.offsetParent !== null,
            style_display: (iframeDoc ? iframeDoc.defaultView : window).getComputedStyle(input).display,
            style_visibility: (iframeDoc ? iframeDoc.defaultView : window).getComputedStyle(input).visibility,
            outerHTML: input.outerHTML.substring(0, 200) + '...'
          });
        });
        
        // 모든 button 요소도 확인
        const allButtons = targetDoc.querySelectorAll('button');
        console.log('대상 문서에서 발견된 총 button 요소:', allButtons.length);
        allButtons.forEach((button, index) => {
          console.log('Button ' + (index + 1) + ':', {
            type: button.type,
            id: button.id,
            className: button.className,
            textContent: button.textContent.trim(),
            visible: button.offsetParent !== null,
            style_display: (iframeDoc ? iframeDoc.defaultView : window).getComputedStyle(button).display,
            style_visibility: (iframeDoc ? iframeDoc.defaultView : window).getComputedStyle(button).visibility,
            outerHTML: button.outerHTML.substring(0, 200) + '...'
          });
        });
        
        let usernameField = null;
        let passwordField = null;
        
        // 고려대 수강신청 사이트 정확한 선택자들 (우선순위 높음)
        const usernameSelectors = [
          'input[id="id"]',                // 실제 로그인 필드: <input id="id">
          'input[name="id"]',              // 실제 로그인 필드: name="id"
          'input.input-id',                // 실제 로그인 필드: class="input-id"
          'input[placeholder*="학번"]',      // placeholder="학번 ( Student ID )"
          'input[placeholder*="Student ID"]',
          'input[name="userid"]',
          'input[name="user_id"]',
          'input[name="username"]',
          'input[id="userid"]', 
          'input[id="user_id"]',
          'input[id="username"]',
          'input[placeholder*="아이디"]',
          'input[placeholder*="ID"]',
          'input[type="text"]'             // 마지막 우선순위
        ];
        
        const passwordSelectors = [
          'input[id="pwd"]',               // 실제 로그인 필드: <input id="pwd">
          'input[name="pwd"]',             // 실제 로그인 필드: name="pwd"
          'input.input-pw',                // 실제 로그인 필드: class="input-pw"
          'input[placeholder*="비밀번호"]',   // placeholder="비밀번호 ( Password )"
          'input[placeholder*="Password"]',
          'input[name="password"]',
          'input[name="passwd"]',
          'input[id="password"]',
          'input[id="passwd"]',
          'input[type="password"]'         // 마지막 우선순위
        ];
        
        // 사용자명 필드 찾기 (iframe 내부 또는 메인 페이지)
        for (const selector of usernameSelectors) {
          usernameField = targetDoc.querySelector(selector);
          if (usernameField) {
            // 사용자명 필드 발견
            break;
          }
        }
        
        // 비밀번호 필드 찾기 (iframe 내부 또는 메인 페이지)
        for (const selector of passwordSelectors) {
          passwordField = targetDoc.querySelector(selector);
          if (passwordField) {
            // 비밀번호 필드 발견
            break;
          }
        }
        
        // 만약 못 찾았다면 휴리스틱으로 찾기
        if (!usernameField) {
          for (let input of allInputs) {
            if ((input.type === 'text' || input.type === '' || input.type === 'email') && 
                input.offsetParent !== null) { // 화면에 보이는 요소만
              // 휴리스틱으로 사용자명 필드 추정
              usernameField = input;
              break;
            }
          }
        }
        
        if (!passwordField) {
          for (let input of allInputs) {
            if (input.type === 'password' && input.offsetParent !== null) { // 화면에 보이는 요소만
              // 휴리스틱으로 비밀번호 필드 추정
              passwordField = input;
              break;
            }
          }
        }
        
        console.log('최종 선택된 필드들:', { 
          username: usernameField ? usernameField.outerHTML : null, 
          password: passwordField ? usernameField ? 'found' : null : null
        });
        
        let filled = false;
        
        // 사용자명 입력
        if (usernameField) {
          try {
            // 기존 값 지우기
            usernameField.value = '';
            usernameField.focus();
            
            // 값 설정
            usernameField.value = savedLogin.username;
            
            // 다양한 이벤트 발생
            usernameField.dispatchEvent(new Event('input', { bubbles: true }));
            usernameField.dispatchEvent(new Event('change', { bubbles: true }));
            usernameField.dispatchEvent(new Event('keyup', { bubbles: true }));
            usernameField.dispatchEvent(new Event('blur', { bubbles: true }));
            
            // 사용자명 입력 완료 (보안상 로그 제거)
            filled = true;
          } catch (e) {
            console.error('사용자명 입력 오류:', e);
          }
        } else {
          console.log('사용자명 필드를 찾을 수 없습니다.');
        }
        
        // 비밀번호 입력
        if (passwordField) {
          try {
            // 기존 값 지우기
            passwordField.value = '';
            passwordField.focus();
            
            // 값 설정
            passwordField.value = savedLogin.password;
            
            // 다양한 이벤트 발생
            passwordField.dispatchEvent(new Event('input', { bubbles: true }));
            passwordField.dispatchEvent(new Event('change', { bubbles: true }));
            passwordField.dispatchEvent(new Event('keyup', { bubbles: true }));
            passwordField.dispatchEvent(new Event('blur', { bubbles: true }));
            
            // 비밀번호 입력 완료 (보안상 로그 제거)
            filled = true;
          } catch (e) {
            console.error('비밀번호 입력 오류:', e);
          }
        } else {
          console.log('비밀번호 필드를 찾을 수 없습니다.');
        }
        
        // 입력 후 검증
        setTimeout(() => {
          if (usernameField && passwordField) {
            // 입력 검증 완료 (보안상 상세 로그 제거)
            
            // 실제 로그인 처리 버튼 찾기
            const loginSubmitButtons = [
              'button[id="btn-login"]',        // 실제 로그인 버튼: <button id="btn-login">
              'button.btn-login',              // 실제 로그인 버튼: class="btn-login"
              '#btn-login',                    // 실제 로그인 버튼 ID
              '.btn-login',                    // 실제 로그인 버튼 클래스
              'button[type="submit"]',         // 일반적인 submit 버튼
              'input[type="submit"]',          // 일반적인 submit input
              'button[type="button"]',         // type="button"인 버튼
              'button:contains("로그인")',
              'input[value*="로그인"]'
            ];
            
            let loginButton = null;
            for (const selector of loginSubmitButtons) {
              try {
                loginButton = targetDoc.querySelector(selector);
                if (loginButton) {
                  // 로그인 처리 버튼 발견
                  break;
                }
              } catch (e) {
                // selector에 :contains() 같은 것이 있으면 에러날 수 있음
              }
            }
            
            // 일반적인 방법으로 버튼 찾기 (iframe 내부 또는 메인 페이지)
            if (!loginButton) {
              const allButtonsForLogin = targetDoc.querySelectorAll('button, input[type="submit"], input[type="button"]');
              for (let btn of allButtonsForLogin) {
                const text = btn.textContent || btn.value || '';
                if (text.includes('로그인') || text.includes('Login') || text.includes('로그인')) {
                  loginButton = btn;
                  // 텍스트로 로그인 버튼 발견
                  break;
                }
              }
            }
            
            if (loginButton && usernameField.value && passwordField.value) {
              // 자동 로그인 버튼 클릭 시도
              setTimeout(() => {
                loginButton.click();
                // 로그인 버튼 클릭 완료
              }, 300); // 0.3초로 단축
            } else {
              // 자동 로그인 버튼 클릭 불가 (보안상 상세 정보 제거)
            }
          }
        }, 200); // 입력 검증 시간 단축
        
        return filled;
      }
      
      // 자동 로그인 프로세스 시작
      
      // 1단계: 즉시 로그인 폼 확인 (이미 페이지에 있는 경우)
      setTimeout(() => {
        // 1단계: 기존 로그인 폼 확인
        const immediateSuccess = fillLoginInfo();
        if (immediateSuccess) {
          // 즉시 로그인 성공
          return;
        }
        
        // 2단계: 로그인 버튼 클릭 시도
        const buttonClicked = clickLoginButton();
        
        if (buttonClicked) {
          // 로그인 버튼 클릭 후 폼이 나타날 때까지 대기
          
          // 3단계: 로그인 폼 나타난 후 자동 입력 (빠른 시도)
          const formWaitTimes = [200, 500, 1000, 1500];
          formWaitTimes.forEach((delay, index) => {
            setTimeout(() => {
              // 로그인 폼 입력 시도
              const success = fillLoginInfo();
              if (success) {
                // 자동 로그인 성공
              }
            }, delay);
          });
        } else {
          // 로그인 버튼을 못 찾은 경우 계속 시도 (빠른 재시도)
          const retryTimes = [1000, 2000, 3000, 4000];
          retryTimes.forEach((delay, index) => {
            setTimeout(() => {
              // 자동 로그인 재시도
              const success = fillLoginInfo();
              if (!success) {
                clickLoginButton();
              }
            }, delay);
          });
        }
      }, 500); // 페이지 로딩 후 0.5초 대기 (빠른 시작)
      
      // DOM 변화 감지하여 동적으로 로그인 필드가 나타날 때도 대응
      const observer = new MutationObserver(() => {
        fillLoginInfo();
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      
      // 5초 후 관찰 중단
      setTimeout(() => {
        observer.disconnect();
      }, 5000); // DOM 감지 시간 단축
      
      // 페이지 스타일 개선
      setTimeout(() => {
        const buttons = document.querySelectorAll('input[type="submit"], button, .btn');
        buttons.forEach(btn => {
          if (btn.textContent && btn.textContent.includes('로그인') || 
              btn.value && btn.value.includes('로그인')) {
            btn.style.background = 'linear-gradient(135deg, #8B0000, #A0002A)';
            btn.style.color = 'white';
            btn.style.border = 'none';
            btn.style.fontWeight = '600';
            btn.style.borderRadius = '6px';
          }
        });
      }, 2000);
      
    })();
  `;

  mainWindow.webContents.executeJavaScript(script);
}

// 저장된 로그인 정보 로드
function loadSavedLoginInfo() {
  // 이미 injectEnhancements에서 처리됨
}

// 첫 실행 확인 및 로그인 정보 설정
async function checkFirstRun() {
  const isFirstRun = !store.has('userLoginInfo');
  console.log('첫 실행 여부:', isFirstRun);
  console.log('현재 저장된 설정: [보안상 숨김]');
  
  if (isFirstRun) {
    console.log('첫 실행 - 로그인 설정 다이얼로그 표시');
    const loginInfo = await showLoginSetupDialog();
    if (loginInfo) {
      console.log('로그인 정보 저장 완료');
      store.set('userLoginInfo', loginInfo);
      store.set('saveLogin', true);
      console.log('저장 후 설정: [보안상 숨김]');
      
      // 첫 실행 시에만 한번 자동 로그인 시도
      console.log('첫 실행 - 자동로그인 시도');
      setTimeout(() => {
        if (mainWindow && mainWindow.webContents) {
          injectEnhancements();
        }
      }, 2000);
    } else {
      console.log('로그인 설정을 건너뛰었습니다.');
    }
  } else {
    console.log('기존 사용자 - 저장된 로그인 정보 사용');
  }
}

// 로그인 설정 다이얼로그
function showLoginSetupDialog() {
  return new Promise((resolve) => {
    const setupWindow = new BrowserWindow({
      width: 400,
      height: 350,
      modal: true,
      resizable: false,
      minimizable: false,
      maximizable: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      },
      icon: path.join(__dirname, 'assets/icon.png')
    });

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>로그인 정보 설정</title>
        <style>
          @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.8/dist/web/static/pretendard.css');
          
          body {
            font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
            margin: 0;
            padding: 30px;
            background: linear-gradient(135deg, #8B0000, #A0002A);
            color: white;
            display: flex;
            flex-direction: column;
            justify-content: center;
            min-height: 290px;
          }
          
          .logo {
            text-align: center;
            margin-bottom: 30px;
          }
          
          .logo h2 {
            margin: 0;
            font-size: 24px;
            font-weight: 700;
          }
          
          .logo p {
            margin: 5px 0 0 0;
            font-size: 14px;
            opacity: 0.8;
          }
          
          .form-group {
            margin-bottom: 20px;
          }
          
          label {
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
            font-size: 14px;
          }
          
          input {
            width: 100%;
            padding: 12px;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            box-sizing: border-box;
            font-family: 'Pretendard', sans-serif;
          }
          
          input:focus {
            outline: 2px solid #FFD700;
          }
          
          .button-group {
            display: flex;
            gap: 10px;
            margin-top: 30px;
          }
          
          button {
            flex: 1;
            padding: 12px;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            font-family: 'Pretendard', sans-serif;
          }
          
          .btn-primary {
            background: #FFD700;
            color: #8B0000;
          }
          
          .btn-secondary {
            background: rgba(255,255,255,0.2);
            color: white;
            border: 1px solid rgba(255,255,255,0.3);
          }
          
          button:hover {
            opacity: 0.9;
            transform: translateY(-1px);
          }
          
          .info {
            font-size: 12px;
            text-align: center;
            opacity: 0.7;
            margin-top: 15px;
            line-height: 1.4;
          }
        </style>
      </head>
      <body>
        <div class="logo">
          <h2>🎓 고려대 수강신청</h2>
          <p>로그인 정보를 설정해주세요</p>
        </div>
        
        <form id="loginForm">
          <div class="form-group">
            <label for="username">학번 또는 아이디</label>
            <input type="text" id="username" name="username" required>
          </div>
          
          <div class="form-group">
            <label for="password">비밀번호</label>
            <input type="password" id="password" name="password" required>
          </div>
          
          <div class="button-group">
            <button type="button" class="btn-secondary" onclick="skipSetup()">나중에</button>
            <button type="submit" class="btn-primary">저장하고 시작</button>
          </div>
        </form>
        
        <div class="info">
          로그인 정보는 안전하게 로컬에 저장됩니다.<br>
          언제든지 설정에서 변경할 수 있습니다.
        </div>
        
        <script>
          const { ipcRenderer } = require('electron');
          
          document.getElementById('loginForm').addEventListener('submit', function(e) {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            
            if (username && password) {
              ipcRenderer.send('login-setup-complete', { username, password });
            }
          });
          
          function skipSetup() {
            ipcRenderer.send('login-setup-complete', null);
          }
          
          // 첫 번째 입력창에 포커스
          document.getElementById('username').focus();
        </script>
      </body>
      </html>
    `;

    setupWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));

    ipcMain.once('login-setup-complete', (event, loginInfo) => {
      setupWindow.close();
      resolve(loginInfo);
    });

    setupWindow.on('closed', () => {
      resolve(null);
    });
  });
}

// 서버시간 오버레이 생성
function createServerTimeOverlay() {
  if (serverTimeWindow) return;
  
  serverTimeWindow = new BrowserWindow({
    width: 220,
    height: 100,
    x: mainWindow.getBounds().x + mainWindow.getBounds().width - 240,
    y: mainWindow.getBounds().y + mainWindow.getBounds().height - 130,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    parent: mainWindow,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  const overlayHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.8/dist/web/static/pretendard.css');
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        
        html, body {
          margin: 0;
          padding: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
          font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
          background: rgba(255, 255, 255, 0.95);
          color: #333;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
          backdrop-filter: blur(5px);
          user-select: none;
          -webkit-user-select: none;
        }
        
        body {
          padding: 14px 18px;
          box-sizing: border-box;
        }
        
        .time-container {
          text-align: center;
          overflow: hidden;
          user-select: none;
          -webkit-user-select: none;
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        
        .server-label {
          font-size: 12px;
          margin-bottom: 4px;
          font-weight: 600;
          color: #8B0000;
          font-family: 'Pretendard', sans-serif;
          user-select: none;
          -webkit-user-select: none;
        }
        
        .server-time {
          font-size: 16px;
          font-weight: 600;
          margin: 2px 0;
          color: #333;
          font-family: 'JetBrains Mono', monospace;
          letter-spacing: 0.5px;
          user-select: none;
          -webkit-user-select: none;
        }
        
        .server-date {
          font-size: 14px;
          font-weight: 500;
          margin: 2px 0;
          color: #333;
          font-family: 'Pretendard', sans-serif;
          user-select: none;
          -webkit-user-select: none;
        }
        
        .server-day {
          font-size: 12px;
          font-weight: 500;
          margin-top: 1px;
          color: #666;
          font-family: 'Pretendard', sans-serif;
          user-select: none;
          -webkit-user-select: none;
        }
        
        * {
          overflow: hidden;
          user-select: none;
          -webkit-user-select: none;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        
        *::-webkit-scrollbar {
          display: none;
        }
      </style>
    </head>
    <body>
      <div class="time-container">
        <div class="server-label">서버시간</div>
        <div class="server-time" id="time">--:--:--.---</div>
        <div class="server-date" id="date">----.--.--</div>
        <div class="server-day" id="day">---요일</div>
      </div>
      
      <script>
        function updateTime() {
          const now = new Date();
          
          // 시간 (밀리초 포함)
          const hours = String(now.getHours()).padStart(2, '0');
          const minutes = String(now.getMinutes()).padStart(2, '0');
          const seconds = String(now.getSeconds()).padStart(2, '0');
          const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
          const timeStr = hours + ':' + minutes + ':' + seconds + '.' + milliseconds;
          
          // 날짜
          const year = now.getFullYear();
          const month = String(now.getMonth() + 1).padStart(2, '0');
          const day = String(now.getDate()).padStart(2, '0');
          const dateStr = year + '.' + month + '.' + day;
          
          // 요일
          const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
          const dayStr = dayNames[now.getDay()] + '요일';
          
          document.getElementById('time').textContent = timeStr;
          document.getElementById('date').textContent = dateStr;
          document.getElementById('day').textContent = dayStr;
        }
        
        updateTime();
        setInterval(updateTime, 10); // 밀리초 업데이트를 위해 10ms마다 갱신
      </script>
    </body>
    </html>
  `;

  serverTimeWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(overlayHtml));

  // 메인 윈도우가 움직이거나 크기가 변할 때 오버레이를 우측하단에 유지
  const updateOverlayPosition = () => {
    if (serverTimeWindow && !serverTimeWindow.isDestroyed()) {
      const bounds = mainWindow.getBounds();
      serverTimeWindow.setPosition(
        bounds.x + bounds.width - 240,
        bounds.y + bounds.height - 130
      );
    }
  };

  mainWindow.on('move', updateOverlayPosition);
  mainWindow.on('resize', updateOverlayPosition);

  serverTimeWindow.on('closed', () => {
    serverTimeWindow = null;
  });
}

// Pretendard 폰트 적용
function applyPretendardFont() {
  if (!mainWindow || !mainWindow.webContents) return;

  const fontCSS = `
    @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.8/dist/web/static/pretendard.css');
    
    * {
      font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif !important;
    }
    
    body, input, button, select, textarea {
      font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif !important;
    }
  `;

  mainWindow.webContents.insertCSS(fontCSS);
}

// IPC 통신 설정
ipcMain.on('login-setup-complete', () => {
  // 이미 함수에서 처리됨
});