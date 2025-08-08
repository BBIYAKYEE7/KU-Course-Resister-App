# 고려대학교 수강신청 도우미

고려대학교 수강신청 시스템을 위한 Electron 기반 데스크톱 애플리케이션입니다.

## 주요 기능

- 🎓 고려대학교 수강신청 사이트 최적화
- 🌙 다크모드 지원
- ⏰ 실시간 서버시간 표시 (새로고침/로그아웃 후에도 유지)
- 🔐 로그인 정보 저장 및 자동 로그인 (59분 59초 999밀리초 정확한 타이밍)
- 📱 반응형 UI 및 최적화된 화면 크기
- 🎨 Pretendard 폰트 적용
- 🔄 자동 업데이트 기능
- ⚡ 최적화된 성능 및 안정성
- 🖥️ 다중 아키텍처 지원 (x64, ia32, arm64)

## 시스템 요구사항

- Windows 10 이상
- Node.js 16 이상
- 관리자 권한 (설치 시)
- 지원 아키텍처: x64, ia32, arm64

## 개발 환경 설정

1. 의존성 설치:
```bash
npm install
```

2. 개발 모드 실행:
```bash
npm run dev
```

## 빌드 및 배포

### 다중 아키텍처 빌드 (권장)

모든 아키텍처를 한 번에 빌드:
```bash
npm run build:win:all
```

또는 배치 파일 사용:
```bash
.\build-multi-arch.bat
```

### 개별 아키텍처 빌드

특정 아키텍처만 빌드하려면:
```bash
# x64 (64비트 Intel/AMD)
npm run build:win:x64

# ia32 (32비트 Intel/AMD)
npm run build:win:ia32

# arm64 (64비트 ARM)
npm run build:win:arm64

# arm64 (64비트 ARM)
npm run build:win:arm64
```

### 1. 앱 패키징

Windows용 실행 파일 생성:
```bash
npx electron-packager . "고려대학교 수강신청" --platform=win32 --arch=x64 --out=dist --overwrite
```

### 2. 인스톨러 생성

#### 방법 1: PowerShell 인스톨러 (권장)

관리자 권한으로 PowerShell을 실행하고:
```powershell
.\create-simple-installer.ps1
```

#### 방법 2: 배치 파일 사용

관리자 권한으로 `install.bat` 실행

#### 방법 3: MSI 인스톨러 (영어 이름)

```bash
# 1. 앱 패키징 (영어 이름)
npx electron-packager . "KoreaUniversitySugang" --platform=win32 --arch=x64 --out=dist --overwrite

# 2. MSI 생성 스크립트 실행
.\create-msi-english.ps1
```

#### 방법 4: Inno Setup 인스톨러

Inno Setup이 설치된 경우:
```bash
# 1. 앱 패키징
npx electron-packager . "KoreaUniversitySugang" --platform=win32 --arch=x64 --out=dist --overwrite

# 2. Inno Setup 스크립트 생성
.\create-msi-english.ps1

# 3. Inno Setup 컴파일러로 MSI 생성
# installer.iss 파일이 생성되면 Inno Setup으로 컴파일
```

## 설치 방법

### 아키텍처 확인

설치 전 시스템 아키텍처를 확인하세요:
1. Windows 키 + R을 눌러 "실행" 창 열기
2. `msinfo32` 입력 후 확인
3. "시스템 요약"에서 "시스템 종류" 확인:
   - x64-based PC: x64 버전 설치
   - x86-based PC: ia32 버전 설치
   - ARM-based PC: arm64 버전 설치

### 자동 설치 (권장)

1. `install.bat` 파일을 관리자 권한으로 실행
2. 설치 완료 후 바탕화면 바로가기 사용

### 수동 설치

1. 시스템에 맞는 아키텍처 버전 선택:
   - `dist\고려대학교 수강신청-x64.exe` (64비트 Intel/AMD)
   - `dist\고려대학교 수강신청-ia32.exe` (32비트 Intel/AMD)
   - `dist\고려대학교 수강신청-arm64.exe` (64비트 ARM)
2. 선택한 파일을 원하는 위치로 복사
3. 실행 파일 실행

## 제거 방법

### 자동 제거

PowerShell을 관리자 권한으로 실행:
```powershell
.\create-simple-installer.ps1 -Uninstall
```

### 수동 제거

1. 제어판 > 프로그램 및 기능에서 "고려대학교 수강신청" 제거
2. 또는 설치 폴더 삭제

## 사용법

1. 앱 실행
2. 첫 실행 시 로그인 정보 설정
3. 고려대학교 수강신청 사이트가 자동으로 로드됨
4. 메뉴에서 다양한 기능 사용 가능:
   - 서버시간 확인 (Ctrl+T)
   - 서버시간 표시 토글
   - 다크모드 토글
   - 로그인 정보 재설정
   - 업데이트 확인
   - 폼 미리 입력
   - 지금 완전 로그인

### 자동 로그인 타이밍

앱은 매시 59분 59초 999밀리초에 정확한 타이밍으로 자동 로그인을 시도합니다. 이는 수강신청 시스템의 정각 로그인보다 1초 빠른 타이밍으로, 더 정확한 로그인을 보장합니다.

### 서버시간 표시

- 우측 하단에 실시간 서버시간이 표시됩니다
- 새로고침이나 로그아웃 후에도 자동으로 재생성됩니다
- 메뉴에서 서버시간 표시를 토글할 수 있습니다

## 빌드 스크립트

### 전체 빌드 프로세스

```bash
# 1. 의존성 설치
npm install

# 2. 다중 아키텍처 빌드
npm run build:win:all

# 3. 인스톨러 생성 (관리자 권한 필요)
.\create-simple-installer.ps1
```

### 배포 파일

빌드 완료 후 다음 파일들이 생성됩니다:

#### 포터블 버전
- `dist\고려대학교 수강신청-x64.exe` - 64비트 Intel/AMD
- `dist\고려대학교 수강신청-ia32.exe` - 32비트 Intel/AMD
- `dist\고려대학교 수강신청-arm64.exe` - 64비트 ARM

#### 인스톨러
- `install.bat` - 배치 파일 설치 스크립트
- `create-simple-installer.ps1` - PowerShell 인스톨러
- `installer.iss` - Inno Setup 스크립트 (Inno Setup 설치 필요)
- `installer.wxs` - WiX Toolset 스크립트 (WiX Toolset 설치 필요)

#### 압축 파일
- `dist\KoreaUniversitySugang.zip` - 압축 파일 (7-Zip으로 생성)

## 문제 해결

### 아키텍처 호환성 문제

"현재 PC에서는 이 앱을 실행할 수 없습니다" 오류가 발생하는 경우:
1. 시스템 아키텍처 확인 (msinfo32)
2. 해당 아키텍처에 맞는 버전 다운로드
3. 32비트 시스템의 경우 ia32 버전 사용
4. ARM 시스템의 경우 arm64 버전 사용

### 빌드 오류

1. Node.js 버전 확인 (16 이상)
2. 관리자 권한으로 실행
3. 캐시 정리: `npm cache clean --force`

### 실행 오류

1. Visual C++ Redistributable 설치
2. Windows Defender 예외 추가
3. 관리자 권한으로 실행

### 설치 오류

1. 관리자 권한 확인
2. 바이러스 백신 일시 비활성화
3. Windows 업데이트 확인

## 라이선스

MIT License

## 기여

버그 리포트나 기능 제안은 GitHub Issues를 이용해주세요.

## 변경 로그

### v1.1.1
- 🖥️ 다중 아키텍처 지원 추가 (x64, ia32, arm64)
- 🔧 아키텍처별 빌드 스크립트 추가
- 📦 다중 아키텍처 인스톨러 지원
- 🐛 아키텍처 호환성 문제 해결

### v1.1.0
- 🎯 정확한 자동 로그인 타이밍 (59분 59초 999밀리초)
- 🔄 서버시간 오버레이 지속성 개선 (새로고침/로그아웃 후에도 유지)
- 🔄 자동 업데이트 기능 추가
- ⚡ 성능 최적화 및 안정성 개선
- 🎨 UI/UX 개선

### v1.0.0
- 초기 릴리스
- 기본 수강신청 기능
- 다크모드 지원
- 서버시간 표시
- 자동 로그인 기능
