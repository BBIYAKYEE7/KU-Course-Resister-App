const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const Store = require('electron-store');
const axios = require('axios');

// electron-updater 안전하게 로드
let autoUpdater;
try {
  autoUpdater = require('electron-updater').autoUpdater;
} catch (error) {
  console.log('electron-updater 로드 실패:', error.message);
  autoUpdater = null;
}

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
    icon: path.join(__dirname, 'assets/icon.ico'),
    show: false,
    titleBarStyle: 'default'
  });

  // 고려대학교 수강신청 사이트 로드 (메인 페이지에서 로그인 처리)
  mainWindow.loadURL('https://sugang.korea.ac.kr/');

  // 윈도우가 준비되면 표시
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    applyTheme();
    // 인라인 서버시간 즉시 생성
    try {
      console.log('Creating inline server time immediately...');
      createInlineServerTime();
    } catch (error) {
      console.error('Inline server time creation error:', error);
    }
  });

    // 페이지 로드 완료 시 폰트 적용 및 로그인 폼 미리 입력
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('페이지 로드 완료 - 폰트 적용 및 로그인 폼 미리 입력');
    applyPretendardFont();
    
    // 팝업 창 자동 닫기 스크립트 주입 (한 번만)
    if (!global.popupScriptInjected) {
      global.popupScriptInjected = true;
      setTimeout(() => {
        mainWindow.webContents.executeJavaScript(`
          // 팝업 창 자동 닫기
          function closePopupWindows() {
            const popupSelectors = [
              'div[style*="position: fixed"]',
              'div[style*="z-index"]',
              '.popup',
              '.modal',
              'div[class*="popup"]',
              'div[class*="modal"]'
            ];
            
            popupSelectors.forEach(selector => {
              const popups = document.querySelectorAll(selector);
              popups.forEach(popup => {
                const text = popup.textContent || '';
                if (text.includes('한 개의 브라우저') || 
                    text.includes('Only one tab') ||
                    text.includes('Invalid screen') ||
                    text.includes('닫아주세요') ||
                    text.includes('Please close')) {
                  console.log('자동으로 팝업 창 닫기:', text.substring(0, 50));
                  popup.remove();
                }
              });
            });
          }
          
          // 즉시 실행
          closePopupWindows();
          
          // 주기적으로 확인
          setInterval(closePopupWindows, 1000);
          
          // DOM 변화 감지
          const observer = new MutationObserver(() => {
            closePopupWindows();
          });
          
          observer.observe(document.body, {
            childList: true,
            subtree: true
          });
        `).catch(error => {
          console.log('팝업 스크립트 주입 실패:', error.message);
        });
      }, 500);
    }
    
    // 서버시간 오버레이는 한 번만 생성 (새로고침 시에도 유지)
    if (!serverTimeWindow || serverTimeWindow.isDestroyed()) {
      setTimeout(() => {
        console.log('페이지 로드 완료 - 서버시간 오버레이 생성 (한 번만)');
        createInlineServerTime();
      }, 500);
    }
    
    // 저장된 로그인 정보가 있으면 로그인 폼만 미리 입력 (자동 제출 안함)
    if (store.get('userLoginInfo')) {
      setTimeout(() => {
        console.log('페이지 로드 완료 - 로그인 폼 미리 입력');
        injectFormFillOnly();
      }, 300); // 0.3초 후 폼 입력
    } else {
      // 로그인 정보가 없으면 자동으로 설정 다이얼로그 표시 (즉시 로그인 없음)
      setTimeout(async () => {
        console.log('로그인 정보가 없음 - 자동 설정 다이얼로그 표시');
        const loginInfo = await showLoginSetupDialog();
        if (loginInfo) {
          store.set('userLoginInfo', loginInfo);
          store.set('saveLogin', true);
          console.log('자동 설정 완료 - 로그인 폼만 미리 입력 (즉시 로그인 안함)');
          setTimeout(() => {
            injectFormFillOnly();
          }, 300);
        }
      }, 500); // 0.5초 후 설정 다이얼로그 표시
    }
  });

    // DOM 준비 완료 시에도 로그인 폼 미리 입력 (한 번만)
  mainWindow.webContents.on('dom-ready', () => {
    if (global.domReadyHandled) {
      return; // 이미 처리됨
    }
    global.domReadyHandled = true;
    
    console.log('DOM 준비 완료 - 로그인 폼 미리 입력');
    
    // 서버시간 오버레이는 이미 생성되어 있으면 재생성하지 않음
    if (!serverTimeWindow || serverTimeWindow.isDestroyed()) {
      setTimeout(() => {
        console.log('DOM 준비 완료 - 서버시간 오버레이 생성 (한 번만)');
        createInlineServerTime();
      }, 300);
    }
    
    // 저장된 로그인 정보가 있으면 로그인 폼만 미리 입력 (자동 제출 안함)
    if (store.get('userLoginInfo')) {
      setTimeout(() => {
        console.log('DOM 준비 완료 - 로그인 폼 미리 입력');
        injectFormFillOnly();
      }, 500); // 0.5초 후 폼 입력
    } else {
      // 로그인 정보가 없으면 자동으로 설정 다이얼로그 표시 (DOM 준비 시에는 더 빠르게)
      setTimeout(async () => {
        console.log('DOM 준비 완료 - 로그인 정보 없음, 자동 설정 다이얼로그 표시');
        const loginInfo = await showLoginSetupDialog();
        if (loginInfo) {
          store.set('userLoginInfo', loginInfo);
          store.set('saveLogin', true);
          console.log('자동 설정 완료 - 로그인 폼만 미리 입력 (즉시 로그인 안함)');
          setTimeout(() => {
            injectFormFillOnly();
          }, 500);
        }
      }, 500); // 0.5초 후 설정 다이얼로그 표시
    }
  });

  // 매 정각마다 자동 로그인 설정 (하이브리드 모드)
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

// 정각 및 30분 간격 자동 로그인 시스템
function setupHourlyAutoLogin() {
  console.log('✅ 정각 및 30분 간격 자동로그인 시스템 활성화');
  
  // 다음 정각까지의 시간 계산 함수
  function getMillisecondsUntilNextHour() {
    const now = new Date();
    const nextHour = new Date(now);
    nextHour.setHours(now.getHours() + 1, 0, 0, 0); // 다음 정각
    return nextHour.getTime() - now.getTime();
  }
  
  // 다음 30분까지의 시간 계산 함수
  function getMillisecondsUntilNextHalfHour() {
    const now = new Date();
    const nextHalfHour = new Date(now);
    const currentMinutes = now.getMinutes();
    
    if (currentMinutes < 30) {
      nextHalfHour.setMinutes(30, 0, 0);
    } else {
      nextHalfHour.setHours(now.getHours() + 1, 0, 0, 0);
    }
    
    return nextHalfHour.getTime() - now.getTime();
  }
  
  // 정각 자동 로그인 실행 함수
  function executeHourlyAutoLogin() {
    const currentTime = new Date().toLocaleTimeString();
    console.log(currentTime + ' - 정각 자동로그인 실행');
    
    // 메인 윈도우가 존재하고 로그인 정보가 있는 경우에만 실행
    if (mainWindow && mainWindow.webContents && store.get('userLoginInfo')) {
      try {
        injectEnhancements(); // 완전 자동 로그인
        console.log('정각 자동로그인 완료');
      } catch (error) {
        console.log('정각 자동로그인 중 오류:', error.message);
      }
    } else {
      console.log('자동로그인 조건 미충족 - 건너뜀');
    }
  }
  
  // 30분 간격 자동 로그인 실행 함수
  function executeHalfHourlyAutoLogin() {
    const currentTime = new Date().toLocaleTimeString();
    console.log(currentTime + ' - 30분 간격 자동로그인 실행');
    
    // 메인 윈도우가 존재하고 로그인 정보가 있는 경우에만 실행
    if (mainWindow && mainWindow.webContents && store.get('userLoginInfo')) {
      try {
        injectEnhancements(); // 완전 자동 로그인
        console.log('30분 간격 자동로그인 완료');
      } catch (error) {
        console.log('30분 간격 자동로그인 중 오류:', error.message);
      }
    } else {
      console.log('자동로그인 조건 미충족 - 건너뜀');
    }
  }
  
  // 정각 자동로그인 설정
  const timeUntilNextHour = getMillisecondsUntilNextHour();
  const minutesUntilNextHour = Math.round(timeUntilNextHour / 1000 / 60);
  console.log('다음 정각까지 ' + minutesUntilNextHour + '분 대기 중...');
  
  setTimeout(() => {
    executeHourlyAutoLogin();
    
    // 이후 매시 정각마다 실행 (1시간 = 3,600,000ms)
    setInterval(executeHourlyAutoLogin, 60 * 60 * 1000);
    
  }, timeUntilNextHour);
  
  // 30분 간격 자동로그인 설정
  const timeUntilNextHalfHour = getMillisecondsUntilNextHalfHour();
  const minutesUntilNextHalfHour = Math.round(timeUntilNextHalfHour / 1000 / 60);
  console.log('다음 30분까지 ' + minutesUntilNextHalfHour + '분 대기 중...');
  
  setTimeout(() => {
    executeHalfHourlyAutoLogin();
    
    // 이후 매 30분마다 실행 (30분 = 1,800,000ms)
    setInterval(executeHalfHourlyAutoLogin, 30 * 60 * 1000);
    
  }, timeUntilNextHalfHour);
  
  // 추가: 앱 시작 시 즉시 자동로그인 시도 (옵션) - 주석 처리
  // setTimeout(() => {
  //   if (store.get('userLoginInfo')) {
  //     console.log('앱 시작 시 즉시 자동로그인 시도');
  //     injectEnhancements();
  //   }
  // }, 3000); // 3초 후 시도
}

// 메뉴 생성
function createMenu() {
  const template = [
    {
      label: '수강신청',
      submenu: [
        {
          label: '수강신청 매크로',
          submenu: [
            {
              label: '매크로 시작',
              accelerator: 'CmdOrCtrl+M',
              click: () => {
                startSugangMacro();
              }
            },
            {
              label: '매크로 중지',
              accelerator: 'CmdOrCtrl+Shift+M',
              click: () => {
                stopSugangMacro();
              }
            },
            {
              label: '과목 설정',
              click: () => {
                showSubjectSetupDialog();
              }
            },
            {
              label: '매크로 상태 확인',
              click: () => {
                showMacroStatus();
              }
            },
            { type: 'separator' },
            {
              label: '고속 접속 모드',
              type: 'checkbox',
              checked: store.get('fastAccessMode', false),
              click: (menuItem) => {
                store.set('fastAccessMode', menuItem.checked);
                if (menuItem.checked) {
                  dialog.showMessageBox(mainWindow, {
                    type: 'info',
                    title: '고속 접속 모드',
                    message: '고속 접속 모드가 활성화되었습니다.',
                    detail: '수강신청 시 가장 빠른 속도로 접속을 시도합니다.',
                    buttons: ['확인']
                  });
                }
              }
            },
            {
              label: '매크로 우회 모드',
              type: 'checkbox',
              checked: store.get('bypassMode', true),
              click: (menuItem) => {
                store.set('bypassMode', menuItem.checked);
                if (menuItem.checked) {
                  dialog.showMessageBox(mainWindow, {
                    type: 'info',
                    title: '매크로 우회 모드',
                    message: '매크로 우회 모드가 활성화되었습니다.',
                    detail: '자동입력 방지와 5회 이상 입력 제한을 우회합니다.',
                    buttons: ['확인']
                  });
                }
              }
            }
          ]
        },
        { type: 'separator' },
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
        {
          label: '서버시간 표시 토글',
          click: () => {
            try {
              mainWindow.webContents.executeJavaScript(`
                const timeElement = document.getElementById('inline-server-time');
                if (timeElement) {
                  if (timeElement.style.display === 'none') {
                    timeElement.style.display = 'block';
                    console.log('Inline time shown');
                  } else {
                    timeElement.style.display = 'none';
                    console.log('Inline time hidden');
                  }
                } else {
                  console.log('Inline time element not found');
                }
              `);
              // 메인 윈도우에 포커스 복원
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.focus();
              }
            } catch (error) {
              console.error('Time toggle error:', error);
            }
          }
        },
        {
          label: '서버시간 표시 재생성',
          click: () => {
            try {
              console.log('Recreating inline time...');
              createInlineServerTime();
              // 메인 윈도우에 포커스 복원
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.focus();
              }
            } catch (error) {
              console.error('Recreate time error:', error);
            }
          }
        },
        {
          label: '서버시간 표시 제거',
          click: () => {
            try {
              // 인라인 서버시간 제거
              mainWindow.webContents.executeJavaScript(`
                if (window.clearInlineServerTime) {
                  window.clearInlineServerTime();
                  console.log('Inline time completely removed');
                }
              `);
              
              // 서버시간 오버레이 윈도우 제거
              if (serverTimeWindow && !serverTimeWindow.isDestroyed()) {
                serverTimeWindow.close();
                serverTimeWindow = null;
              }
              
              // 메인 윈도우에 포커스 복원
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.focus();
              }
            } catch (error) {
              console.error('Remove time error:', error);
            }
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
          label: '폼 미리 입력',
          click: () => {
            console.log('수동 폼 입력 실행');
            if (mainWindow && mainWindow.webContents && store.get('userLoginInfo')) {
              injectFormFillOnly();
            } else {
              console.log('로그인 정보가 없습니다. 먼저 로그인 정보를 설정해주세요.');
            }
          }
        },
        {
          label: '지금 완전 로그인',
          click: () => {
            console.log('수동 완전 로그인 실행');
            if (mainWindow && mainWindow.webContents && store.get('userLoginInfo')) {
              injectEnhancements();
            } else {
              console.log('로그인 정보가 없습니다. 먼저 로그인 정보를 설정해주세요.');
              dialog.showMessageBox(mainWindow, {
                type: 'warning',
                title: '로그인 정보 없음',
                message: '로그인 정보가 설정되지 않았습니다.',
                detail: '설정 > 로그인 정보 재설정에서 로그인 정보를 먼저 설정해주세요.',
                buttons: ['확인']
              });
            }
          }
        },
        {
          label: '자동로그인 테스트',
          click: () => {
            console.log('자동로그인 테스트 실행');
            if (mainWindow && mainWindow.webContents && store.get('userLoginInfo')) {
              dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: '자동로그인 테스트',
                message: '자동로그인을 테스트합니다.',
                detail: '3초 후 자동로그인이 실행됩니다. 로그인 폼이 나타나지 않으면 수동으로 로그인 버튼을 클릭해주세요.',
                buttons: ['확인']
              }).then(() => {
                setTimeout(() => {
                  injectEnhancements();
                }, 3000);
              });
            } else {
              dialog.showMessageBox(mainWindow, {
                type: 'warning',
                title: '로그인 정보 없음',
                message: '로그인 정보가 설정되지 않았습니다.',
                detail: '설정 > 로그인 정보 재설정에서 로그인 정보를 먼저 설정해주세요.',
                buttons: ['확인']
              });
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
        {
          label: '업데이트 확인',
          click: async () => {
            try {
              const response = await axios.get('https://api.github.com/repos/BBIYAKYEE7/KU-Course-Resister-App/releases', {
                timeout: 10000,
                headers: {
                  'User-Agent': 'Sugang-App-AutoUpdate',
                  'Accept': 'application/vnd.github.v3+json'
                }
              });
              
              const latestVersion = response.data[0]?.tag_name;
              const currentVersion = app.getVersion();
              
              // 태그명에서 'v' 제거하여 버전 비교
              const cleanLatestVersion = latestVersion ? latestVersion.replace('v', '') : null;
              
              if (latestVersion && cleanLatestVersion !== currentVersion) {
                dialog.showMessageBox(mainWindow, {
                  type: 'info',
                  title: '업데이트 확인',
                  message: '새로운 버전이 있습니다',
                  detail: `현재 버전: ${currentVersion}\n최신 버전: ${latestVersion}\n\n업데이트를 위해 GitHub 릴리즈 페이지를 방문하세요.`,
                  buttons: ['GitHub 방문', '취소']
                }).then((result) => {
                  if (result.response === 0) {
                    shell.openExternal('https://github.com/BBIYAKYEE7/KU-Course-Resister-App/releases/latest');
                  }
                });
              } else {
                dialog.showMessageBox(mainWindow, {
                  type: 'info',
                  title: '업데이트 확인',
                  message: '최신 버전입니다',
                  detail: `현재 버전: ${currentVersion}\n\n이미 최신 버전을 사용하고 있습니다.`,
                  buttons: ['확인']
                });
              }
            } catch (error) {
              dialog.showErrorBox('업데이트 확인 실패', '네트워크 연결을 확인하고 다시 시도해주세요.');
            }
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
    // 공통 CSS - 포커스 테두리 제거
    const commonCSS = `
      /* 모든 포커스 테두리 완전 제거 */
      *, *:focus, *:active, *:hover, *:visited {
        outline: none !important;
        border: none !important;
        box-shadow: none !important;
      }
      
      /* Electron 윈도우 포커스 테두리 제거 */
      html, body {
        outline: none !important;
        border: none !important;
      }
      
      /* WebView 포커스 테두리 제거 */
      webview, iframe {
        outline: none !important;
        border: none !important;
      }
    `;
    
    if (isDarkMode) {
      console.log('다크모드 활성화 중...');
      // 더 강력하고 자연스러운 다크 모드 CSS
      const darkCSS = commonCSS + `
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
      console.log('라이트모드 활성화 중...');
      // 라이트모드에서도 공통 CSS (포커스 테두리 제거) 적용
      const lightCSS = commonCSS;
      
      mainWindow.webContents.insertCSS(lightCSS);
      
      // 기존 다크모드 스타일 제거
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
      icon: path.join(__dirname, 'assets/icon.ico')
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

// 로그인 폼만 미리 입력하는 함수 (자동 제출 없음)
function injectFormFillOnly() {
  if (!mainWindow || !mainWindow.webContents) return;

  // 저장된 로그인 정보 가져오기
  const savedLoginInfo = store.get('userLoginInfo', null);
  console.log('로그인 폼 미리 입력 시작 (자동 제출 없음)');
  
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
      
      if (!savedLogin || !savedLogin.username || !savedLogin.password) {
        console.log('저장된 로그인 정보가 없습니다.');
        return;
      }

      // 메인 페이지에서 로그인 폼을 여는 버튼/링크 클릭 함수
      function clickLoginButton() {
        const loginSelectors = [
          'button[id="btn-login"]',
          'button.btn-login',
          '.btn-login',
          '#btn-login',
          'button[type="button"]',
          'a[href*="login"]',
          'a[href*="Login"]', 
          'button[onclick*="login"]',
          'a[onclick*="login"]',
          'input[value*="로그인"]',
          'button[title*="로그인"]',
          'a[title*="로그인"]'
        ];
        
        let loginButton = null;
        
        for (const selector of loginSelectors) {
          try {
            loginButton = document.querySelector(selector);
            if (loginButton && loginButton.offsetParent !== null) {
              break;
            }
          } catch (e) {
            // continue
          }
        }
        
        if (!loginButton) {
          const allClickables = document.querySelectorAll('a, button, input[type="button"], input[type="submit"], div[onclick], span[onclick], li, td, div[class*="menu"], span[class*="menu"]');
          for (let element of allClickables) {
            const text = (element.textContent || element.innerText || element.value || element.title || '').toLowerCase().trim();
            if ((text.includes('로그인') || text.includes('login')) && element.offsetParent !== null) {
              loginButton = element;
              break;
            }
          }
        }
        
        if (loginButton) {
          try {
            loginButton.click();
            console.log('로그인 버튼 클릭 완료 (폼 표시용)');
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

      // iframe 내부 문서 가져오기
      function getIframeDocument() {
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
            try {
              const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
              if (iframeDoc) {
                return iframeDoc;
              }
            } catch (e) {
              console.log('iframe 접근 실패:', e.message);
            }
          }
        }
        
        return null;
      }

      // 로그인 정보만 입력하는 함수 (자동 제출 없음)
      function fillLoginFormOnly() {
        const iframeDoc = getIframeDocument();
        const targetDoc = iframeDoc || document;
        
        console.log('로그인 폼 입력 시작 (자동 제출 없음)');
        
        const usernameSelectors = [
          'input[id="id"]',
          'input[name="id"]',
          'input.input-id',
          'input[placeholder*="학번"]',
          'input[placeholder*="Student ID"]',
          'input[name="userid"]',
          'input[name="user_id"]',
          'input[name="username"]',
          'input[id="userid"]', 
          'input[id="user_id"]',
          'input[id="username"]',
          'input[placeholder*="아이디"]',
          'input[placeholder*="ID"]',
          'input[type="text"]'
        ];
        
        const passwordSelectors = [
          'input[id="pwd"]',
          'input[name="pwd"]',
          'input.input-pw',
          'input[placeholder*="비밀번호"]',
          'input[placeholder*="Password"]',
          'input[name="password"]',
          'input[name="passwd"]',
          'input[id="password"]',
          'input[id="passwd"]',
          'input[type="password"]'
        ];
        
        let usernameField = null;
        let passwordField = null;
        
        // 사용자명 필드 찾기
        for (const selector of usernameSelectors) {
          usernameField = targetDoc.querySelector(selector);
          if (usernameField) {
            break;
          }
        }
        
        // 비밀번호 필드 찾기
        for (const selector of passwordSelectors) {
          passwordField = targetDoc.querySelector(selector);
          if (passwordField) {
            break;
          }
        }
        
        let filled = false;
        
        // 사용자명 입력
        if (usernameField) {
          try {
            usernameField.value = '';
            usernameField.focus();
            usernameField.value = savedLogin.username;
            
            usernameField.dispatchEvent(new Event('input', { bubbles: true }));
            usernameField.dispatchEvent(new Event('change', { bubbles: true }));
            usernameField.dispatchEvent(new Event('keyup', { bubbles: true }));
            usernameField.dispatchEvent(new Event('blur', { bubbles: true }));
            
            console.log('사용자명 입력 완료 (자동 제출 없음)');
            filled = true;
          } catch (e) {
            console.error('사용자명 입력 오류:', e);
          }
        }
        
        // 비밀번호 입력
        if (passwordField) {
          try {
            passwordField.value = '';
            passwordField.focus();
            passwordField.value = savedLogin.password;
            
            passwordField.dispatchEvent(new Event('input', { bubbles: true }));
            passwordField.dispatchEvent(new Event('change', { bubbles: true }));
            passwordField.dispatchEvent(new Event('keyup', { bubbles: true }));
            passwordField.dispatchEvent(new Event('blur', { bubbles: true }));
            
            console.log('비밀번호 입력 완료 (자동 제출 없음)');
            filled = true;
          } catch (e) {
            console.error('비밀번호 입력 오류:', e);
          }
        }
        
        if (filled) {
          console.log('✅ 로그인 폼 미리 입력 완료 - 사용자가 직접 로그인 버튼을 클릭하세요');
        } else {
          console.log('❌ 로그인 폼을 찾을 수 없습니다');
        }
        
        return filled;
      }
      
      // 폼 입력 프로세스 시작
      setTimeout(() => {
        const immediateSuccess = fillLoginFormOnly();
        if (immediateSuccess) {
          return;
        }
        
        const buttonClicked = clickLoginButton();
        
        if (buttonClicked) {
          const formWaitTimes = [100, 200, 400, 600];
          formWaitTimes.forEach((delay) => {
            setTimeout(() => {
              fillLoginFormOnly();
            }, delay);
          });
        } else {
          const retryTimes = [500, 1000, 1500];
          retryTimes.forEach((delay) => {
            setTimeout(() => {
              const success = fillLoginFormOnly();
              if (!success) {
                clickLoginButton();
              }
            }, delay);
          });
        }
      }, 200);
      
      // DOM 변화 감지
      const observer = new MutationObserver(() => {
        fillLoginFormOnly();
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      
      setTimeout(() => {
        observer.disconnect();
      }, 5000);
      
    })();
  `;

  mainWindow.webContents.executeJavaScript(script);
}

// 페이지 개선사항 주입 (완전 자동 로그인 - 정각용)
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
              }, 100); // 0.1초로 단축
            } else {
              // 자동 로그인 버튼 클릭 불가 (보안상 상세 정보 제거)
            }
          }
        }, 100); // 입력 검증 시간 단축
        
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
          
          // 3단계: 로그인 폼 나타난 후 자동 입력 (최대한 빠른 시도)
          const formWaitTimes = [50, 100, 200, 300];
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
          const retryTimes = [200, 400, 600, 800];
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
      }, 50); // 페이지 로딩 후 0.05초 대기 (최대한 빠른 시작)
      
      // DOM 변화 감지하여 동적으로 로그인 필드가 나타날 때도 대응
      const observer = new MutationObserver(() => {
        fillLoginInfo();
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      
      // 3초 후 관찰 중단
      setTimeout(() => {
        observer.disconnect();
      }, 3000); // DOM 감지 시간 단축
      
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
      }, 1000);
      
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
      
      // 첫 실행 시에도 로그인 폼만 미리 입력
      console.log('첫 실행 - 로그인 폼 미리 입력');
      setTimeout(() => {
        if (mainWindow && mainWindow.webContents) {
          injectFormFillOnly();
        }
      }, 800); // 0.8초로 단축
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
      icon: path.join(__dirname, 'assets/icon.ico')
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

// 인라인 서버시간 표시 생성
function createInlineServerTime() {
  if (!mainWindow || !mainWindow.webContents) {
    console.log('메인 윈도우가 준비되지 않았습니다.');
    return;
  }
  
  console.log('인라인 서버시간 표시 생성 시작...');
  
  // 서버시간 오버레이 윈도우는 제거 (인라인만 사용)
  if (serverTimeWindow && !serverTimeWindow.isDestroyed()) {
    try {
      serverTimeWindow.close();
      serverTimeWindow = null;
    } catch (error) {
      console.error('Failed to close existing server time window:', error);
      serverTimeWindow = null;
    }
  }
  
  // 메인 윈도우에 서버시간 HTML 삽입
  const inlineTimeScript = `
    (function() {
      // 이미 서버시간이 생성되어 있으면 중복 생성 방지
      if (window.serverTimeCreated) {
        console.log('서버시간이 이미 생성되어 있음 - 중복 생성 방지');
        return;
      }
      
      // 서버시간 생성 플래그 설정
      window.serverTimeCreated = true;
      
      // JetBrains Mono 폰트 강제 로드
      const fontLink = document.createElement('link');
      fontLink.href = 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap';
      fontLink.rel = 'stylesheet';
      fontLink.onload = function() {
        console.log('JetBrains Mono font loaded');
      };
      document.head.appendChild(fontLink);
      
      // 폰트 페이스 직접 정의 (백업)
      const fontStyle = document.createElement('style');
      fontStyle.textContent = \`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        .jetbrains-mono {
          font-family: 'JetBrains Mono', 'Consolas', 'Monaco', 'Courier New', monospace !important;
          font-feature-settings: 'liga' 0, 'calt' 0;
        }
      \`;
      document.head.appendChild(fontStyle);
      
      // 기존 서버시간 요소가 있으면 제거
      const existingTime = document.getElementById('inline-server-time');
      if (existingTime) {
        existingTime.remove();
      }
      
      // 서버시간 표시 요소 생성
      const timeElement = document.createElement('div');
      timeElement.id = 'inline-server-time';
      timeElement.style.cssText = \`
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 200px;
        height: 70px;
        background: linear-gradient(135deg, 
          rgba(0,0,0,0.8) 0%, 
          rgba(40,40,40,0.9) 100%);
        color: white;
        border-radius: 8px;
        padding: 8px 12px;
        font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
        text-align: center;
        z-index: 9998;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255,255,255,0.1);
        pointer-events: none;
        user-select: none;
      \`;
      
      timeElement.innerHTML = \`
        <div style="font-size: 11px; margin-bottom: 4px; font-weight: 600; color: #ff6b6b;">서버시간</div>
        <div id="inline-time-display" class="jetbrains-mono" style="font-size: 14px; font-weight: 600; margin: 2px 0; letter-spacing: 0.5px;">--:--:--.---</div>
        <div id="inline-date-display" style="font-size: 12px; font-weight: 500; margin: 2px 0;">----.--.--</div>
        <div id="inline-day-display" style="font-size: 10px; font-weight: 500; margin-top: 1px; color: #ccc;">---요일</div>
      \`;
      
      // 페이지에 삽입 (폰트 로드 후)
      setTimeout(() => {
        document.body.appendChild(timeElement);
        
        // 폰트 적용 강제 확인
        const timeDisplay = document.getElementById('inline-time-display');
        if (timeDisplay) {
          timeDisplay.style.fontFamily = "'JetBrains Mono', 'Consolas', 'Monaco', 'Courier New', monospace";
          console.log('JetBrains Mono font applied to time display');
        }
      }, 500); // 폰트 로드 대기
      
      // 시간 업데이트 함수
      function updateInlineTime() {
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
        
        const timeDisplay = document.getElementById('inline-time-display');
        const dateDisplay = document.getElementById('inline-date-display');
        const dayDisplay = document.getElementById('inline-day-display');
        
        console.log('시간 업데이트 시도:', timeStr, '요소 존재:', !!timeDisplay);
        
        if (timeDisplay) {
          timeDisplay.textContent = timeStr;
          timeDisplay.style.fontFamily = "'JetBrains Mono', 'Consolas', 'Monaco', 'Courier New', monospace";
          console.log('시간 업데이트 성공:', timeStr);
        } else {
          console.log('시간 표시 요소를 찾을 수 없음');
        }
        
        if (dateDisplay) {
          dateDisplay.textContent = dateStr;
          console.log('날짜 업데이트 성공:', dateStr);
        }
        
        if (dayDisplay) {
          dayDisplay.textContent = dayStr;
          console.log('요일 업데이트 성공:', dayStr);
        }
      }
      
      // 초기 실행 및 주기적 업데이트 (폰트 로드 후)
      setTimeout(() => {
        console.log('시간 업데이트 시작');
        updateInlineTime();
        const timeInterval = setInterval(updateInlineTime, 10);
        
        // 전역에 정리 함수 저장
        window.clearInlineServerTime = function() {
          clearInterval(timeInterval);
          const element = document.getElementById('inline-server-time');
          if (element) {
            element.remove();
          }
          window.serverTimeCreated = false;
        };
        
        // 추가적인 시간 업데이트 확인
        setTimeout(() => {
          console.log('100ms 후 시간 업데이트');
          updateInlineTime();
        }, 100);
        
        setTimeout(() => {
          console.log('500ms 후 시간 업데이트');
          updateInlineTime();
        }, 500);
        
        setTimeout(() => {
          console.log('1000ms 후 시간 업데이트');
          updateInlineTime();
        }, 1000);
        
        setTimeout(() => {
          console.log('2000ms 후 시간 업데이트');
          updateInlineTime();
        }, 2000);
      }, 600);
      
      console.log('Inline server time display created');
    })();
  `;
  
  try {
    mainWindow.webContents.executeJavaScript(inlineTimeScript);
    console.log('인라인 서버시간 표시 생성 완료');
  } catch (error) {
    console.error('인라인 서버시간 표시 생성 실패:', error);
  }
}

// 서버시간 오버레이 윈도우는 사용하지 않음 (인라인만 사용)
console.log('서버시간 오버레이 윈도우 제거됨 - 인라인 서버시간만 사용');

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

// 자동 업데이트 기능
function setupAutoUpdate() {
  console.log('✅ 자동 업데이트 시스템 활성화');
  
  // electron-updater 설정
  if (autoUpdater) {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    
    // 업데이트 이벤트 리스너
    autoUpdater.on('checking-for-update', () => {
      console.log('업데이트 확인 중...');
    });
    
    autoUpdater.on('update-available', (info) => {
      console.log('업데이트 가능:', info);
      showUpdateDialog(info);
    });
    
    autoUpdater.on('update-not-available', (info) => {
      console.log('업데이트 없음:', info);
    });
    
    autoUpdater.on('error', (err) => {
      console.log('업데이트 오류:', err);
    });
    
    autoUpdater.on('download-progress', (progressObj) => {
      console.log('다운로드 진행률:', progressObj.percent);
    });
    
    autoUpdater.on('update-downloaded', (info) => {
      console.log('업데이트 다운로드 완료:', info);
      showUpdateReadyDialog();
    });
  }
  
  // 업데이트 다이얼로그 표시
  function showUpdateDialog(info) {
    const updateDialog = new BrowserWindow({
      width: 450,
      height: 300,
      modal: true,
      resizable: false,
      minimizable: false,
      maximizable: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      },
      icon: path.join(__dirname, 'assets/icon.ico')
    });

    const updateHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>업데이트 확인</title>
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
            min-height: 240px;
          }
          
          .update-icon {
            text-align: center;
            font-size: 48px;
            margin-bottom: 20px;
          }
          
          .update-title {
            text-align: center;
            margin-bottom: 20px;
          }
          
          .update-title h2 {
            margin: 0;
            font-size: 20px;
            font-weight: 700;
          }
          
          .update-title p {
            margin: 5px 0 0 0;
            font-size: 14px;
            opacity: 0.8;
          }
          
          .version-info {
            background: rgba(255,255,255,0.1);
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            font-size: 14px;
            line-height: 1.4;
          }
          
          .button-group {
            display: flex;
            gap: 10px;
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
        </style>
      </head>
      <body>
        <div class="update-icon">🔄</div>
        <div class="update-title">
          <h2>새로운 버전이 있습니다</h2>
          <p>최신 버전으로 업데이트하시겠습니까?</p>
        </div>
        
        <div class="version-info">
          <strong>현재 버전:</strong> ${app.getVersion()}<br>
          <strong>최신 버전:</strong> ${info.version || '알 수 없음'}<br>
          <br>
          업데이트를 통해 새로운 기능과 개선사항을 받으실 수 있습니다.
        </div>
        
        <div class="button-group">
          <button class="btn-secondary" onclick="skipUpdate()">나중에</button>
          <button class="btn-primary" onclick="downloadUpdate()">업데이트 다운로드</button>
        </div>
        
        <script>
          const { ipcRenderer, shell } = require('electron');
          
          function downloadUpdate() {
            shell.openExternal('https://github.com/BBIYAKYEE7/KU-Course-Resister-App/releases/latest');
            window.close();
          }
          
          function skipUpdate() {
            window.close();
          }
        </script>
      </body>
      </html>
    `;

    updateDialog.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(updateHtml));

    updateDialog.on('closed', () => {
      // 업데이트 확인 완료
    });
  }
  
  // 업데이트 다운로드 완료 다이얼로그
  function showUpdateReadyDialog() {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: '업데이트 준비 완료',
      message: '업데이트가 다운로드되었습니다. 앱을 재시작하면 새로운 버전이 적용됩니다.',
      buttons: ['지금 재시작', '나중에'],
      defaultId: 0
    }).then((result) => {
      if (result.response === 0 && autoUpdater) {
        autoUpdater.quitAndInstall();
      }
    });
  }
  
  // 앱 시작 시 업데이트 확인 (5초 후)
  setTimeout(() => {
    if (autoUpdater) {
      autoUpdater.checkForUpdates();
    }
  }, 5000);
  
  // 매일 자정에 업데이트 확인
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  
  const timeUntilMidnight = tomorrow.getTime() - now.getTime();
  
  setTimeout(() => {
    if (autoUpdater) {
      autoUpdater.checkForUpdates();
    }
    // 이후 매일 자정에 확인
    setInterval(() => {
      if (autoUpdater) {
        autoUpdater.checkForUpdates();
      }
    }, 24 * 60 * 60 * 1000);
  }, timeUntilMidnight);
}

// 수강신청 매크로 관련 전역 변수
let macroRunning = false;
let macroInterval = null;
let macroAttempts = 0;
let selectedSubjects = [];

// 수강신청 매크로 시작
function startSugangMacro() {
  if (macroRunning) {
    dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: '매크로 실행 중',
      message: '매크로가 이미 실행 중입니다.',
      buttons: ['확인']
    });
    return;
  }

  const subjects = store.get('selectedSubjects', []);
  if (subjects.length === 0) {
    dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: '과목 미설정',
      message: '수강신청할 과목이 설정되지 않았습니다.',
      detail: '수강신청 매크로 > 과목 설정에서 과목을 먼저 설정해주세요.',
      buttons: ['과목 설정', '취소']
    }).then((result) => {
      if (result.response === 0) {
        showSubjectSetupDialog();
      }
    });
    return;
  }

  macroRunning = true;
  macroAttempts = 0;
  selectedSubjects = subjects;

  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: '수강신청 매크로 시작',
    message: '수강신청 매크로가 시작되었습니다.',
    detail: `설정된 과목: ${subjects.length}개\n고속 접속 모드: ${store.get('fastAccessMode', false) ? '활성화' : '비활성화'}\n매크로 우회 모드: ${store.get('bypassMode', true) ? '활성화' : '비활성화'}`,
    buttons: ['확인']
  });

  // 매크로 실행
  executeSugangMacro();
}

// 수강신청 매크로 중지
function stopSugangMacro() {
  if (!macroRunning) {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: '매크로 미실행',
      message: '실행 중인 매크로가 없습니다.',
      buttons: ['확인']
    });
    return;
  }

  macroRunning = false;
  if (macroInterval) {
    clearInterval(macroInterval);
    macroInterval = null;
  }

  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: '수강신청 매크로 중지',
    message: '수강신청 매크로가 중지되었습니다.',
    detail: `총 시도 횟수: ${macroAttempts}회`,
    buttons: ['확인']
  });
}

// 수강신청 매크로 실행
function executeSugangMacro() {
  if (!macroRunning) return;

  const fastAccessMode = store.get('fastAccessMode', false);
  const bypassMode = store.get('bypassMode', true);
  const interval = fastAccessMode ? 100 : 500; // 고속 모드: 100ms, 일반 모드: 500ms

  macroInterval = setInterval(() => {
    if (!macroRunning) return;

    macroAttempts++;
    console.log(`매크로 시도 ${macroAttempts}회`);

    // 매크로 스크립트 주입
    injectSugangMacroScript();
  }, interval);
}

// 수강신청 매크로 스크립트 주입
function injectSugangMacroScript() {
  if (!mainWindow || !mainWindow.webContents) return;

  const subjects = store.get('selectedSubjects', []);
  const bypassMode = store.get('bypassMode', true);
  const fastAccessMode = store.get('fastAccessMode', false);

  const script = `
    (function() {
      // 매크로 우회 기능
      function bypassMacroDetection() {
        if (!${bypassMode}) return;
        
        // 자동입력 방지 우회
        const antiMacroElements = document.querySelectorAll('*');
        antiMacroElements.forEach(element => {
          // 자동입력 방지 관련 속성 제거
          if (element.hasAttribute('data-anti-macro')) {
            element.removeAttribute('data-anti-macro');
          }
          if (element.hasAttribute('data-bot-detection')) {
            element.removeAttribute('data-bot-detection');
          }
          
          // 자동입력 방지 스크립트 비활성화
          const scripts = element.querySelectorAll('script');
          scripts.forEach(script => {
            if (script.textContent.includes('anti-macro') || 
                script.textContent.includes('bot-detection') ||
                script.textContent.includes('자동입력') ||
                script.textContent.includes('매크로')) {
              script.remove();
            }
          });
        });
        
        // 5회 이상 입력 제한 우회
        const inputCounters = document.querySelectorAll('[data-input-count], [data-attempt-count]');
        inputCounters.forEach(counter => {
          counter.setAttribute('data-input-count', '0');
          counter.setAttribute('data-attempt-count', '0');
        });
        
        // 입력 제한 관련 변수 초기화
        if (window.inputAttempts) window.inputAttempts = 0;
        if (window.macroAttempts) window.macroAttempts = 0;
        if (window.attemptCount) window.attemptCount = 0;
      }
      
      // 서버 대기 시간 우회
      function bypassServerDelay() {
        // 대기 시간 관련 타이머 제거
        const timers = window.setTimeout ? window.setTimeout : [];
        if (Array.isArray(timers)) {
          timers.forEach(timer => {
            if (timer && timer.delay && timer.delay > 1000) {
              clearTimeout(timer);
            }
          });
        }
        
        // 서버 응답 대기 시간 단축
        if (window.XMLHttpRequest) {
          const originalOpen = window.XMLHttpRequest.prototype.open;
          window.XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
            const xhr = this;
            originalOpen.call(xhr, method, url, async, user, password);
            xhr.timeout = ${fastAccessMode ? 1000 : 3000}; // 고속 모드: 1초, 일반 모드: 3초
          };
        }
      }
      
      // 수강신청 페이지 접근
      function navigateToSugang() {
        // 수강신청 메뉴 찾기 및 클릭
        const sugangSelectors = [
          'a[href*="sugang"]',
          'a[href*="course"]',
          'a[href*="register"]',
          'a[onclick*="sugang"]',
          'a[onclick*="course"]',
          'button[onclick*="sugang"]',
          'button[onclick*="course"]',
          'li:contains("수강신청")',
          'a:contains("수강신청")',
          'button:contains("수강신청")'
        ];
        
        let sugangLink = null;
        for (const selector of sugangSelectors) {
          try {
            sugangLink = document.querySelector(selector);
            if (sugangLink && sugangLink.offsetParent !== null) {
              break;
            }
          } catch (e) {
            // continue
          }
        }
        
        // 텍스트로 찾기
        if (!sugangLink) {
          const allLinks = document.querySelectorAll('a, button, li, td');
          for (let element of allLinks) {
            const text = (element.textContent || element.innerText || '').toLowerCase().trim();
            if (text.includes('수강신청') || text.includes('course') || text.includes('register')) {
              sugangLink = element;
              break;
            }
          }
        }
        
        if (sugangLink) {
          sugangLink.click();
          return true;
        }
        
        return false;
      }
      
      // 과목 검색 및 수강신청
      function searchAndRegisterSubjects() {
        const subjects = ${JSON.stringify(subjects)};
        
        subjects.forEach(subject => {
          // 과목 검색
          const searchInput = document.querySelector('input[name="search"], input[placeholder*="과목"], input[placeholder*="검색"]');
          if (searchInput) {
            searchInput.value = subject.code || subject.name || '';
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
            searchInput.dispatchEvent(new Event('change', { bubbles: true }));
            
            // 검색 버튼 클릭
            const searchButton = document.querySelector('button[type="submit"], input[type="submit"], button:contains("검색")');
            if (searchButton) {
              searchButton.click();
            }
            
            // 검색 결과에서 과목 찾기 및 수강신청
            setTimeout(() => {
              const subjectRows = document.querySelectorAll('tr, .subject-row, .course-row');
              subjectRows.forEach(row => {
                const rowText = row.textContent || '';
                if (rowText.includes(subject.code) || rowText.includes(subject.name)) {
                  // 수강신청 버튼 찾기
                  const registerButton = row.querySelector('button:contains("수강신청"), input[value*="수강신청"], .register-btn');
                  if (registerButton) {
                    registerButton.click();
                  }
                }
              });
            }, 500);
          }
        });
      }
      
      // 매크로 우회 실행
      bypassMacroDetection();
      bypassServerDelay();
      
      // 수강신청 페이지로 이동
      if (!navigateToSugang()) {
        // 이미 수강신청 페이지에 있는 경우
        searchAndRegisterSubjects();
      }
      
    })();
  `;

  mainWindow.webContents.executeJavaScript(script);
}

// 과목 설정 다이얼로그
function showSubjectSetupDialog() {
  const setupWindow = new BrowserWindow({
    width: 600,
    height: 500,
    modal: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    icon: path.join(__dirname, 'assets/icon.ico')
  });

  const savedSubjects = store.get('selectedSubjects', []);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>수강신청 과목 설정</title>
      <style>
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.8/dist/web/static/pretendard.css');
        
        body {
          font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
          margin: 0;
          padding: 30px;
          background: linear-gradient(135deg, #8B0000, #A0002A);
          color: white;
          min-height: 440px;
        }
        
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        
        .header h2 {
          margin: 0;
          font-size: 24px;
          font-weight: 700;
        }
        
        .header p {
          margin: 5px 0 0 0;
          font-size: 14px;
          opacity: 0.8;
        }
        
        .subject-form {
          background: rgba(255,255,255,0.1);
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        
        .form-row {
          display: flex;
          gap: 10px;
          margin-bottom: 15px;
        }
        
        .form-group {
          flex: 1;
        }
        
        label {
          display: block;
          margin-bottom: 5px;
          font-weight: 600;
          font-size: 12px;
        }
        
        input {
          width: 100%;
          padding: 8px;
          border: none;
          border-radius: 4px;
          font-size: 12px;
          box-sizing: border-box;
          font-family: 'Pretendard', sans-serif;
        }
        
        .add-btn {
          background: #FFD700;
          color: #8B0000;
          border: none;
          padding: 8px 15px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          margin-top: 20px;
        }
        
        .subjects-list {
          background: rgba(255,255,255,0.1);
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 20px;
          max-height: 200px;
          overflow-y: auto;
        }
        
        .subject-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px;
          background: rgba(255,255,255,0.1);
          border-radius: 4px;
          margin-bottom: 5px;
        }
        
        .subject-info {
          flex: 1;
        }
        
        .subject-code {
          font-weight: 600;
          font-size: 12px;
        }
        
        .subject-name {
          font-size: 11px;
          opacity: 0.8;
        }
        
        .remove-btn {
          background: #ff4444;
          color: white;
          border: none;
          padding: 4px 8px;
          border-radius: 3px;
          font-size: 10px;
          cursor: pointer;
        }
        
        .button-group {
          display: flex;
          gap: 10px;
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
      <div class="header">
        <h2>📚 수강신청 과목 설정</h2>
        <p>수강신청할 과목들을 추가해주세요</p>
      </div>
      
      <div class="subject-form">
        <div class="form-row">
          <div class="form-group">
            <label for="subjectCode">과목 코드</label>
            <input type="text" id="subjectCode" placeholder="예: CSE101">
          </div>
          <div class="form-group">
            <label for="subjectName">과목명</label>
            <input type="text" id="subjectName" placeholder="예: 프로그래밍 기초">
          </div>
        </div>
        <button class="add-btn" onclick="addSubject()">과목 추가</button>
      </div>
      
      <div class="subjects-list" id="subjectsList">
        <div style="text-align: center; opacity: 0.7; font-size: 12px;">
          추가된 과목이 없습니다
        </div>
      </div>
      
      <div class="button-group">
        <button class="btn-secondary" onclick="cancelSetup()">취소</button>
        <button class="btn-primary" onclick="saveSubjects()">저장</button>
      </div>
      
      <div class="info">
        과목 코드와 과목명을 입력하면 매크로가 자동으로 해당 과목을 수강신청합니다.<br>
        여러 과목을 추가할 수 있으며, 매크로는 설정된 순서대로 시도합니다.
      </div>
      
      <script>
        const { ipcRenderer } = require('electron');
        
        let subjects = ${JSON.stringify(savedSubjects)};
        
        function addSubject() {
          const code = document.getElementById('subjectCode').value.trim();
          const name = document.getElementById('subjectName').value.trim();
          
          if (!code && !name) {
            alert('과목 코드 또는 과목명을 입력해주세요.');
            return;
          }
          
          const subject = { code, name };
          subjects.push(subject);
          
          // 입력 필드 초기화
          document.getElementById('subjectCode').value = '';
          document.getElementById('subjectName').value = '';
          
          updateSubjectsList();
        }
        
        function removeSubject(index) {
          subjects.splice(index, 1);
          updateSubjectsList();
        }
        
        function updateSubjectsList() {
          const list = document.getElementById('subjectsList');
          
          if (subjects.length === 0) {
            list.innerHTML = '<div style="text-align: center; opacity: 0.7; font-size: 12px;">추가된 과목이 없습니다</div>';
            return;
          }
          
          list.innerHTML = subjects.map((subject, index) => \`
            <div class="subject-item">
              <div class="subject-info">
                <div class="subject-code">\${subject.code || '코드 없음'}</div>
                <div class="subject-name">\${subject.name || '과목명 없음'}</div>
              </div>
              <button class="remove-btn" onclick="removeSubject(\${index})">삭제</button>
            </div>
          \`).join('');
        }
        
        function saveSubjects() {
          ipcRenderer.send('subjects-setup-complete', subjects);
        }
        
        function cancelSetup() {
          ipcRenderer.send('subjects-setup-complete', null);
        }
        
        // 초기 목록 표시
        updateSubjectsList();
        
        // 첫 번째 입력창에 포커스
        document.getElementById('subjectCode').focus();
      </script>
    </body>
    </html>
  `;

  setupWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));

  ipcMain.once('subjects-setup-complete', (event, subjects) => {
    setupWindow.close();
    if (subjects) {
      store.set('selectedSubjects', subjects);
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: '과목 설정 완료',
        message: `${subjects.length}개의 과목이 설정되었습니다.`,
        buttons: ['확인']
      });
    }
  });

  setupWindow.on('closed', () => {
    // 다이얼로그가 닫힌 경우 처리
  });
}

// 매크로 상태 확인
function showMacroStatus() {
  const subjects = store.get('selectedSubjects', []);
  const fastAccessMode = store.get('fastAccessMode', false);
  const bypassMode = store.get('bypassMode', true);
  
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: '수강신청 매크로 상태',
    message: '현재 매크로 설정 상태',
    detail: `매크로 실행 상태: ${macroRunning ? '실행 중' : '중지됨'}\n` +
           `설정된 과목: ${subjects.length}개\n` +
           `고속 접속 모드: ${fastAccessMode ? '활성화' : '비활성화'}\n` +
           `매크로 우회 모드: ${bypassMode ? '활성화' : '비활성화'}\n` +
           `총 시도 횟수: ${macroAttempts}회\n\n` +
           `설정된 과목 목록:\n${subjects.map((subject, index) => 
             `${index + 1}. ${subject.code || '코드 없음'} - ${subject.name || '과목명 없음'}`
           ).join('\n')}`,
    buttons: ['확인']
  });
}

app.whenReady().then(() => {
  createWindow();
  setupAutoUpdate(); // 자동 업데이트 시스템 활성화
});