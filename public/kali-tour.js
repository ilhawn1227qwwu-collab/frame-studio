
/* Guided Kali XFCE tour. Simulated OS only; requires actual user interactions. */
(()=>{'use strict';
const $=id=>document.getElementById(id),KEY='kali-sim-tour-v1-complete';
const I=(title,body,target,tip,next)=>({mode:'info',title,body,target,tip,next});
const C=(title,body,target,hint)=>({mode:'click',title,body,target,hint});
const M=(mode,title,body,target,hint)=>({mode,title,body,target,hint});
const stages=[
 I('Kali Linux에 오신 걸 환영해요!','Linux는 Windows처럼 컴퓨터를 작동시키는 운영체제(OS)예요. Kali Linux는 보안 실습에 필요한 도구를 모아 놓은 리눅스 배포판이고요.',null,'지금은 진짜 Kali OS가 아니라, 브라우저 안에서 작동하는 가상 실습 데스크톱이에요. 하나씩 눌러봅시다!','바탕화면 살펴보기'),
 C('왼쪽 위 버튼이 뭘까요?','Kali 로고 옆 Applications 버튼은 윈도우의 시작 메뉴 같은 거예요. 눌러보세요!','#menu-btn','강조된 Applications 버튼을 눌러보세요.'),
 I('와, 프로그램 메뉴가 열렸어요!','이곳에서 설치된 프로그램을 찾아요. 카테고리를 구분해서 보안 도구를 탐색할 수 있어요.','#menu-panel .menu-head','Kali는 정보 수집, 무선 네트워크, 분석 등 분야별 보안 도구를 제공해요.','네트워크 프로그램 찾아보기'),
 C('Wi-Fi 프로그램을 찾아볼까요?','Network Connections 버튼을 눌러서 무선 네트워크 목록을 열어볼게요.','#menu-panel button[data-open="wifi"]','메뉴에서 Network Connections를 눌러주세요.'),
 I('여기가 NetworkManager예요.','리눅스에서 네트워크 연결을 확인하는 도구예요. LAB-TRAINING은 연습용 가상 Wi-Fi 이름(SSID)이에요.','#wifi .window-head','SSID는 와이파이 이름, WPA2·WPA3는 보안 방식이에요.','네트워크 정보 살펴보기'),
 C('이 버튼도 눌러봅시다!','LAB-TRAINING 오른쪽에 있는 정보 보기 버튼을 눌러주세요.','#wifi .net.target button','정보 보기 버튼을 눌러주세요.'),
 I('오, 네트워크 정보가 나왔네요!','BSSID는 접속 지점을 식별하는 값이고, 채널은 무선 통신에 쓰는 주파수 구분이에요.','#net-info','이 정보는 실제 주변 Wi-Fi를 스캔한 게 아니라 미리 만들어 둔 가상 데이터예요.','바탕화면으로 돌아가기'),
 C('바탕화면으로 돌아가요!','Wi-Fi 창 오른쪽 위 × 버튼을 눌러 닫아보세요.','#wifi [data-close="wifi"]','× 버튼을 눌러 창을 닫아주세요.'),
 C('이번에는 터미널을 눌러봐요.','바탕화면 Terminal 아이콘을 열어볼게요. 리눅스를 배우는 데 아주 중요한 도구예요.','.desktop-shortcuts [data-open="terminal"]','바탕화면 Terminal 아이콘을 눌러보세요.'),
 I('짜잔! 터미널이에요.','터미널은 글자로 명령을 내려 시스템을 조작하는 공간이에요. 파일 탐색, 시스템 확인, 프로그램 실행에 쓰여요.','#terminal .window-head','명령어의 뜻을 알고 실행 결과를 읽는 게 핵심이에요.','첫 명령어 사용하기'),
 M('command','직접 help를 입력해 봐요!','입력칸에 help를 치고 Enter 또는 실행 버튼을 눌러주세요. 이 가상 터미널에서 쓸 수 있는 명령이 보여요.','#shell-input','help를 입력하고 Enter를 눌러주세요.'),
 I('잘했어요! 명령이 실행됐네요.','명령어 목록이 보이죠? 나중에는 whoami, pwd, ls, ip a도 입력해 보세요. 실제 리눅스에서도 쓰는 명령이에요.','#terminal .terminal-log','다만 이 화면의 실행 결과는 JavaScript로 만든 교육용 시뮬레이션이에요.','터미널 닫기'),
 C('터미널에서 나와볼까요?','창 오른쪽 위의 × 버튼을 누르면 바탕화면으로 돌아갈 수 있어요.','#terminal [data-close="terminal"]','터미널의 × 버튼을 눌러주세요.'),
 C('Home 아이콘은 뭐예요?','리눅스의 파일 탐색기 Thunar를 열어볼까요? Windows 파일 탐색기와 비슷한 역할이에요.','.desktop-shortcuts [data-open="files"]','바탕화면 Home 아이콘을 눌러주세요.'),
 I('여기가 파일 관리자 Thunar예요.','주소 /home/kali는 kali 사용자 홈 폴더의 경로예요. 폴더와 파일을 살펴볼 수 있어요.','#files .gtk-toolbar','리눅스에서 / 문자는 폴더 경로를 구분해요.','실습 폴더 찾아보기'),
 C('lab-files 폴더도 열어볼까요?','왼쪽 목록에서 lab-files를 누르면 연습용 자료들이 나와요.','#file-sidebar [data-place="lab-files"]','왼쪽 lab-files 폴더를 눌러주세요.'),
 I('학습 자료 폴더를 발견했어요!','lab-demo.txt에는 교육용 암호 후보가 들어 있어요. labcap-01.cap은 Wi-Fi 실습에서 가상 인증 교환 예제를 만들면 나타나요.','#file-items','목록은 실제 시스템이 아니라 브라우저 내부의 가상 파일 시스템과 연동돼요.','바탕화면으로 돌아가기'),
 C('파일 관리자도 닫아볼까요?','오른쪽 위 × 버튼을 눌러주세요.','#files [data-close="files"]','Thunar의 × 버튼을 눌러주세요.'),
 C('이젠 Lab Notes를 열어봐요.','바탕화면의 Lab Notes는 실습 방법을 설명한 메모장이에요.','.desktop-shortcuts [data-open="guide"]','Lab Notes 아이콘을 눌러주세요.'),
 I('여기가 학습 노트예요!','실습에서 사용할 명령어와 주의할 점을 읽을 수 있어요. 낯선 개념이 나오면 이곳부터 확인해요.','#guide .window-body',null,'노트 창 닫기'),
 C('다시 바탕화면으로!','노트 창의 × 버튼을 눌러주세요.','#guide [data-close="guide"]','Lab Notes 창의 × 버튼을 눌러주세요.'),
 C('이번엔 화면을 꾸며볼까요?','바탕화면 Appearance 아이콘은 모양 설정이에요.','.desktop-shortcuts [data-open="appearance"]','Appearance 아이콘을 눌러주세요.'),
 I('모양 설정 창이네요!','Kali Dark 스타일과 배경화면을 바꿔볼 수 있어요. 직접 변경해 볼까요?','#appearance .appearance-options',null,'배경 바꿔보기'),
 M('change','배경화면을 골라보세요.','Desktop Wallpaper 목록에서 Graphite Dark 또는 Ocean Blue를 선택해 주세요.','#wallpaper-choice','현재 기본값과 다른 배경을 선택해 보세요.'),
 I('바뀌었어요!','화면 색상이 달라졌네요. 이렇게 리눅스의 데스크톱은 원하는 대로 꾸밀 수 있어요.','#appearance .appearance-preview','선택한 테마는 지금 쓰는 브라우저에 저장돼요.','설정 창 닫기'),
 C('마지막으로 바탕화면으로!','Appearance 창 오른쪽 위의 × 버튼을 눌러주세요.','#appearance [data-close="appearance"]','× 버튼을 눌러주세요.'),
 I('이제 새로 추가된 프로그램도 탐험해 볼까요?','Kali 데스크톱에는 학습센터, 가상 웹 브라우저, 네트워크 지도, 종합 임무와 자유 실습까지 준비돼 있어요. 지금부터 하나씩 직접 열어볼게요.','.desktop-shortcuts .course-shortcut','기존 리눅스·Wi-Fi 입문 다음 과정이에요. 다른 과목의 저장된 진도는 건드리지 않을게요.','학습센터로 이동'),
 C('Learning Center를 직접 열어볼까요?','바탕화면의 Learning Center 아이콘을 눌러 보세요. 7가지 학습 과정과 모드를 한곳에서 선택할 수 있어요.','.desktop-shortcuts .course-shortcut','Learning Center 아이콘을 눌러주세요.'),
 I('와, 과목이 여러 개 있네요!','왼쪽 목록을 보면 리눅스 기초, 네트워크 기초, Wi-Fi, 웹 보안, 포렌식, 종합 임무, 자유 실습이 있어요. 과목을 눌러 내용을 둘러보죠.','#course-list','이제부터는 과목을 골라 보기만 해요. 실제 실습은 「선택한 실습 시작」 버튼을 누를 때 열려요.','첫 번째 과목 보기'),
 C('리눅스 기초를 눌러 보세요.','파일과 폴더, 현재 작업 위치를 확인하는 가장 기본적인 실습이에요.','#course-list button[data-track="linux"]','리눅스 기초를 선택해 주세요.'),
 I('리눅스 기초 — 6단계','pwd로 위치 확인 → ls로 목록 확인 → mkdir로 폴더 생성 → cd로 이동 → touch로 파일 생성 → ls -l로 확인해요. 결과는 Thunar 파일 관리자와 연동돼요.','#course-stages','단계에서 명령을 직접 입력하면 가상 폴더나 파일이 만들어져요.','다음 과목 보기'),
 C('네트워크 기초는 어떨까요?','이번에는 IP 주소, 라우팅, 게이트웨이, DNS를 배우는 과정이에요.','#course-list button[data-track="network"]','네트워크 기초를 눌러주세요.'),
 I('네트워크 기초 — 5단계','ip a로 장치를 확인하고 ip route로 경로를 읽어요. 그다음 ping, nslookup, curl을 사용해서 가상 서버와의 연결을 살펴보죠.','#course-stages','가상 공유기의 전원을 끄거나 Kali PC의 연결이 끊기면 결과도 달라져요.','Wi-Fi 과목 알아보기'),
 C('익숙한 Wi-Fi 보안 과목도 있어요.','처음 배운 무선 네트워크 실습을 학습센터에서도 선택할 수 있어요.','#course-list button[data-track="wireless"]','Wi-Fi 보안 실습을 눌러주세요.'),
 I('Wi-Fi 보안 — 9단계','무선 장치 확인 → 대상 네트워크 관찰 → 교육용 인증 이벤트 준비 → 암호 점검 → 연결 → WPA3 보안 강화까지 이어져요.','#course-stages','Wi-Fi 실습 안내는 진행률 패널에 나타나고, 연결·캡처는 모두 가상으로 처리해요.','웹 보안 과목 알아보기'),
 C('이번엔 웹 보안을 눌러보세요.','웹사이트가 왜 위험해질 수 있고, 설정을 어떻게 개선하는지 배우는 과목이에요.','#course-list button[data-track="web"]','웹 보안을 선택해 주세요.'),
 I('웹 보안 — 9단계','가상 사이트 확인 → HTTP 검사 → 취약 설정 진단 → SSH로 서버 접속 → 설정 개선 → Kali로 복귀 → 재검증 순서예요.','#course-stages','웹 서버 상태는 Firefox SIM과 같은 가상 환경을 공유해요.','포렌식 과목 알아보기'),
 C('로그와 디지털 포렌식도 있어요!','사건의 흔적을 조사하고 증거가 변경되지 않았는지 검증하는 공부예요.','#course-list button[data-track="forensics"]','로그·디지털 포렌식을 눌러주세요.'),
 I('포렌식 — 7단계','가상 웹 서버에 SSH로 접속해 서버 로그를 읽고, Kali로 돌아와 증거 파일 SHA-256을 검증해요. sha256sum으로 학습용 증거의 해시도 계산해요.','#course-stages','로그에 실패 기록이 있다고 바로 침입 성공을 뜻하는 건 아니에요.','종합 임무로 이동'),
 C('종합 임무 INCIDENT-001을 찾아보세요.','여러 과목의 지식을 실제 사건처럼 연결해 보는 과정이에요.','#course-list button[data-track="incident"]','종합 임무를 선택해 주세요.'),
 I('종합 임무 — 8개의 목표','Kali에서 서버 장애를 확인하고 SSH로 web01에 접속해 로그를 조사해요. 가상 sudo 권한으로 서비스를 재시작하고 보안 설정을 개선한 다음 보고서를 만들어요.','#course-stages','과목 시작 버튼을 누르면 가상 사건이 시작되고, 기존의 종합 임무 저장 상태에 따라 이어서 진행할 수도 있어요.','마지막 모드 알아보기'),
 C('자유 실습 모드를 눌러보세요.','이제는 정해진 순서 없이 가상 네트워크와 서버를 관찰하는 모드예요.','#course-list button[data-track="sandbox"]','자유 실습을 선택해 주세요.'),
 I('자유 실습 — 순서 없이 탐색','help로 지원 명령을 찾고, ping과 curl로 상태를 확인하거나 Firefox·네트워크 지도를 열 수 있어요.','#course-desc','정해진 답을 그대로 입력하는 대신, 원하는 기능을 스스로 골라 실험할 수 있어요.','시작 버튼 살펴보기'),
 I('선택한 실습 시작은 무엇일까요?','이 버튼을 누르면 선택한 과목이 활성화되고 터미널에 그 과목의 안내가 나타나요. 종합 임무는 실제로 시작하면 웹 서버 장애 시나리오를 준비해요.','#course-start','지금은 기존 진도를 보존하려고 눌러보지는 않을게요.','진도 초기화 버튼 살펴보기'),
 I('과목 초기화도 구분되어 있어요.','각 과목의 초기화는 해당 과목의 연습 기록을 다시 시작하는 기능이에요. Wi-Fi 실습은 별도의 초기화 버튼이 있으니 주의하세요.','#course-reset','초기화는 실제 기록을 지울 수 있으므로 튜토리얼에서는 직접 실행하지 않아요.','학습센터 닫기'),
 C('이제 학습센터를 닫아봐요.','다음에는 Kali 데스크톱의 가상 웹 브라우저를 직접 살펴볼 차례예요.','#course-close','학습센터 오른쪽 위 × 버튼을 눌러주세요.'),
 C('Firefox SIM을 열어볼까요?','바탕화면의 Firefox SIM은 가상 사내 웹사이트만 열 수 있는 학습용 브라우저예요.','.desktop-shortcuts .lan-browser-shortcut','Firefox SIM 아이콘을 눌러주세요.'),
 I('웹 브라우저가 열렸어요!','주소창에 http://training.lab 같은 연습 주소를 입력할 수 있어요. 실제 웹에 접속하지 않고 웹페이지·HTTP 응답을 내부에서 재현해요.','#lan-address','연습 가능한 주소는 training.lab, demo.lab, 192.0.2.20뿐이에요.','상태 페이지 살펴보기'),
 C('상태 페이지를 눌러보세요.','페이지 아래의 「상태」 버튼을 눌러서 서버 상태를 직접 확인해 봐요.','#lan-browser-page .lan-links button:nth-child(2)','상태 버튼을 눌러주세요.'),
 I('이것이 서버 응답이에요.','HTTP 200은 요청이 처리되었다는 뜻이에요. 서버를 중단하면 503, 없는 페이지면 404가 나타날 수 있어요.','#lan-browser-page .lan-http-status','서버가 꺼져 있다고 Wi-Fi 연결 자체가 끊긴 건 아니에요. 네트워크와 서비스 장애를 구분해야 해요.','관리자 화면 살펴보기'),
 C('관리자 경로도 눌러볼까요?','「관리자」 버튼을 눌러봐요. 접근 제어가 적용되었는지에 따라 페이지가 달라져요.','#lan-browser-page .lan-links button:nth-child(3)','관리자 버튼을 눌러주세요.'),
 I('웹 보안에서 배운 내용이 여기에 보여요.','접근 통제 설정이 없다면 교육용 관리자 자료가 보이고, 설정을 적용했다면 403 Forbidden으로 막혀요.','#lan-browser-page .lan-http-status','이렇게 웹 보안 과목에서 고친 설정이 실제로 보이는 가상 웹페이지에도 반영돼요.','Firefox 닫기'),
 C('Firefox를 닫아볼까요?','이제 네트워크 자체를 그림으로 보여주는 프로그램으로 이동해요.','#lan-browser .lan-close','Firefox 오른쪽 위 × 버튼을 눌러주세요.'),
 C('Network Map 아이콘을 눌러보세요.','가상 회사 안의 PC, 공유기, 웹 서버와 로그 서버를 한 화면에서 볼 수 있어요.','.desktop-shortcuts .lan-map-shortcut','Network Map 아이콘을 눌러주세요.'),
 I('4개의 가상 장치가 연결되어 있네요!','Kali PC(192.0.2.10), Router(192.0.2.1), Web Server(192.0.2.20), Log Server(192.0.2.30)로 구성돼 있어요.','#lan-topology','이 주소들은 문서·실습을 위한 가상 네트워크 범위에 속해요.','서버 선택해 보기'),
 C('웹 서버를 선택해 보세요.','서버 상태가 정상인지, 서비스가 멈췄는지 상세 정보를 확인할 수 있어요.','#lan-topology .lan-device[data-device="web"]','Web Server 카드를 눌러주세요.'),
 I('서버 전원과 웹 서비스는 달라요.','서버 자체는 ONLINE이지만 HTTP만 STOPPED일 수 있어요. 이때 ping은 성공해도 Firefox에서 503이 나타날 수 있어요.','#lan-device-detail','같은 가상 서버 상태를 여러 앱이 함께 읽는 구조예요.','로그 서버 알아보기'),
 C('Log Server도 눌러보세요.','보안 사건 기록을 다루는 가상 로그 서버예요.','#lan-topology .lan-device[data-device="log"]','Log Server 카드를 눌러주세요.'),
 I('여기에 사건 기록이 쌓여요.','가상 인증 실패 기록과 네트워크 변경 이벤트를 확인해 포렌식 실습에서 원인을 분석할 수 있어요.','#lan-device-detail','실제 이용자의 기록이나 외부 서버 로그를 수집하지 않아요.','공유기 살펴보기'),
 C('공유기도 살펴볼까요?','네트워크의 출구인 가상 Router 카드를 선택해 보세요.','#lan-topology .lan-device[data-device="router"]','Lab Router 카드를 눌러주세요.'),
 I('공유기가 꺼지면 어떻게 될까요?','공유기 전원이 꺼지면 웹 서버와 Kali PC 사이의 연결도 끊겨요. 그래서 ping과 curl이 성공하지 못할 수 있어요.','#lan-device-detail','NetworkManager의 공유기 전원 버튼으로 직접 상태를 바꿀 수 있지만 지금은 기존 실습 상태를 유지할게요.','네트워크 지도 도구 살펴보기'),
 I('지도 아래에도 버튼이 있네요.','Firefox 열기, SSH 접속 안내, 웹 서버 전원 제어, INCIDENT-001 시작, 서비스 재시작 명령 입력 등이 있어요.','#lan-map-actions','종합 임무 시작은 기존 사건 기록을 바꿀 수 있어서 튜토리얼에서는 누르지 않아요.','지도 닫기'),
 C('네트워크 지도를 닫아봐요.','이제 공유기 전원과 클라이언트를 실제로 제어하는 화면을 살펴볼게요.','#lan-map .lan-close','Network Map의 × 버튼을 눌러주세요.'),
 C('Wi-Fi 프로그램을 다시 열어봅시다.','앞서 본 Wi-Fi 목록 안에 네트워크를 조작할 수 있는 제어판이 추가됐어요.','.desktop-shortcuts [data-open="wifi"]','Wi-Fi 아이콘을 눌러주세요.'),
 I('가상 네트워크 제어판이 보이나요?','공유기 전원, 채널, 연습용 암호, 클라이언트 준비 여부를 바꿀 수 있어요. 서버 전원과는 다른 기능이에요.','#sim-radio','실습 진도가 바뀔 수 있어 지금은 기능 설명만 하고 설정을 변경하지 않을게요.','인증 이벤트 버튼 살펴보기'),
 I('연습용 클라이언트 재연결 버튼이에요.','이 버튼은 학습용 클라이언트가 다시 연결했다는 가상 인증 이벤트를 만들어요. Wi-Fi 캡처 실습에서 사용하는 값이에요.','#sim-reconnect','이 클라이언트는 Kali 컴퓨터와 별개의 가상 장치예요.','Kali PC 연결 버튼 살펴보기'),
 I('Kali PC 연결 버튼은 달라요.','이쪽은 Kali PC 자체를 가상 Wi-Fi에 접속시키는 기능이에요. WPA3로 암호를 변경한 다음 새 암호로 다시 연결할 때 사용해요.','#sim-station-connect','교육용 암호만 입력하세요. 실제 사용하는 비밀번호를 넣을 필요는 없어요.','네트워크 목록 살펴보기'),
 I('여기에서 현재 Wi-Fi를 확인해요.','SSID와 채널, 보안 방식은 위의 가상 공유기 설정에 따라 달라져요. 지금 보이는 이름들은 실제 주변 네트워크가 아니에요.','#nets','네트워크를 찾는 것과 연결하는 것, 인증 이벤트를 관찰하는 것은 모두 다른 행동이에요.','Wi-Fi 창 닫기'),
 C('네트워크 설정 창을 닫아봐요.','다음은 공유기의 보안 설정을 강화하는 관리자 창이에요.','#wifi [data-close="wifi"]','Wi-Fi의 × 버튼을 눌러주세요.'),
 C('Router 아이콘을 눌러보세요.','학습용 공유기의 관리자 설정 화면을 살펴보죠.','.desktop-shortcuts [data-open="router"]','Router 아이콘을 눌러주세요.'),
 I('여기서 WPA3 보안을 설정해요.','Wi-Fi 접속 암호와 공유기 관리자 인증은 서로 달라요. 실습의 마지막 단계에서는 WPA3-SAE와 강한 새 암호를 적용한 뒤 다시 확인해요.','#router-form','지금은 실제 진도를 보존하기 위해 적용 버튼은 누르지 않아요.','설정 창 닫기'),
 C('설정 창을 닫아볼까요?','이제 자주 쓰는 데스크톱 버튼들을 마지막으로 알아볼게요.','#router [data-close="router"]','Router 창의 × 버튼을 눌러주세요.'),
 I('실습 진행률은 여기서 확인해요.','9단계 Wi-Fi 실습과 실습 안내가 표시되는 패널이에요. 다른 과목에서는 해당 과목의 안내가 터미널 주변에 나타나요.','#mission','모바일에서는 터미널 위의 접이식 안내를 열어 설명을 확인해요.','힌트 버튼 알아보기'),
 I('모를 때는 힌트를 받아도 괜찮아요.','실습 진행률 아래 「힌트」 버튼으로 다음 명령을 찾아볼 수 있어요. 진행이 막히면 학습 노트를 먼저 확인해 보세요.','#hint-btn','한 번 틀려도 괜찮아요. 입력 결과를 읽고 원인을 확인하는 과정이 학습이에요.','도움말 버튼 알아보기'),
 I('도움말을 다시 보고 싶다면?','상단의 ? 튜토리얼 버튼을 누르면 지금처럼 화면 전체를 다시 안내해 줘요. 새로 추가된 아이콘 안내도 따로 다시 볼 수 있어요.','#onboard-restart','다음에 어떤 버튼인지 기억나지 않을 때 다시 열어보세요.','작업 표시줄 알아보기'),
 I('아래에는 작업 표시줄이 있어요.','터미널, Network, 학습센터, Firefox SIM, Network Map을 바로 열 수 있어요. 작은 모바일 화면에서도 중요한 바로가기 역할을 해요.','.taskbar','창이 다른 창을 가려도 작업 표시줄에서 다시 선택할 수 있어요.','화면 제어 살펴보기'),
 I('전체화면과 종료 버튼을 기억해요.','전체화면 버튼으로 화면을 넓게 쓰고, 전원 버튼으로 가상 컴퓨터를 종료할 수 있어요. 다시 켜면 튜토리얼이 먼저 시작돼요.','#shutdown-btn','실제 휴대전화나 컴퓨터 전원을 종료하는 버튼은 아니에요.','안전한 초기화 살펴보기'),
 I('초기화 버튼은 신중히 사용해요.','Wi-Fi 초기화는 Wi-Fi 실습용 기록을 초기화하고, 과목별 초기화는 선택한 과목의 진도를 되돌려요. 저장된 임무를 유지하고 싶다면 누르지 마세요.','#reset-btn','초기화 기능을 누르기 전 어떤 기록이 지워지는지 확인하세요.','마지막 아이콘 안내로'),
 I('Kali 데스크톱 전체 탐험 성공!','기본 Linux 조작, 7개 학습 모드, Firefox SIM, 네트워크 지도, 가상 클라이언트, 관리자 설정까지 알아봤어요.\n마지막으로 아이콘별 기능을 한눈에 볼 수 있는 요약표를 띄워 줄게요.',null,'「아이콘 설명 보기」를 누르면 각 앱의 역할과 사용할 시점을 간단하게 다시 확인할 수 있어요.','아이콘 설명 보기')
];
const root=document.createElement('div');root.id='onboard-root';root.hidden=true;
root.innerHTML='<div id="onboard-spot" aria-hidden="true"></div>'+
'<section id="onboard-card" role="dialog" aria-labelledby="ob-title" aria-describedby="ob-body" tabindex="-1">'+
'<div class="ob-head"><span class="ob-brand">KALI · DESKTOP TOUR</span><span id="ob-number" class="ob-number"></span></div>'+
'<div class="ob-progress"><div id="ob-progress"></div></div>'+
'<div class="ob-content"><div class="ob-icon" aria-hidden="true">⌘</div><h2 id="ob-title"></h2><p id="ob-body"></p>'+
'<div id="ob-learn" class="ob-learn"></div><div id="ob-action" class="ob-action" hidden><span></span><div id="ob-action-text"></div></div></div>'+
'<div class="ob-footer"><button id="ob-skip" class="ob-skip" type="button">건너뛰기</button><button id="ob-chapters" class="ob-skip" type="button" aria-expanded="false">단원 선택</button><button id="ob-resume" class="ob-skip" type="button" hidden>이어서 보기</button>'+
'<button id="ob-next" class="ob-next" type="button">다음</button></div><nav id="ob-chapter-list" class="ob-chapter-list" aria-label="튜토리얼 단원" hidden></nav></section>';
$('desktop').append(root);
const card=$('onboard-card'),spot=$('onboard-spot'),next=$('ob-next');
const chapterDefinitions=[
 ['리눅스·데스크톱','Kali Linux에 오신 걸 환영해요!'],
 ['학습센터·7개 과정','이제 새로 추가된 프로그램도 탐험해 볼까요?'],
 ['Firefox·HTTP','Firefox SIM을 열어볼까요?'],
 ['네트워크 지도·서버','Network Map 아이콘을 눌러보세요.'],
 ['Wi-Fi·관리자 설정','Wi-Fi 프로그램을 다시 열어봅시다.'],
 ['단축키·아이콘 안내','실습 진행률은 여기서 확인해요.']
];
const chapters=chapterDefinitions.map(([title,begin])=>({title,start:stages.findIndex(x=>x.title===begin)}));
if(chapters.some(x=>x.start<0))throw Error('Tutorial chapter start not found');
const CHECKPOINT='kali-sim-tour-chapter-v1';
function checkpoint(){try{return Number(localStorage.getItem(CHECKPOINT))||0}catch(_){return 0}}
function setCheckpoint(n){try{localStorage.setItem(CHECKPOINT,String(n))}catch(_){}}
function chapterOf(n){return chapters.reduce((best,x,i)=>n>=x.start?i:best,0)}
const chapterList=$('ob-chapter-list');
// A separate fixed dialog avoids clipping through the scrollable tour card on mobile.
root.append(chapterList);
chapters.forEach((ch,n)=>{
 const b=document.createElement('button');b.type='button';b.textContent=(n+1)+'. '+ch.title;
 b.addEventListener('click',()=>jumpToChapter(n));chapterList.append(b);
});
function toggleChapters(force){
 const show=force===undefined?chapterList.hidden:!!force;
 chapterList.hidden=!show;$('ob-chapters').setAttribute('aria-expanded',String(show));
}
$('ob-chapters').addEventListener('click',()=>toggleChapters());
function jumpToChapter(n){
 const ch=chapters[n];if(!ch||!active)return;
 if(originalCourse&&window.KaliCurriculum?.snapshot()?.active!==originalCourse)
  window.KaliCurriculum.selectTrack(originalCourse);
 resetDesktop();toggleChapters(false);index=ch.start;setCheckpoint(n);show();
}
$('ob-resume').addEventListener('click',()=>jumpToChapter(checkpoint()));

// Tour card clicks must not be treated as outside-clicks by the XFCE launcher.
card.addEventListener('pointerdown',event=>event.stopPropagation());
const panel=document.querySelector('.panel-right');
const restart=document.createElement('button');restart.id='onboard-restart';restart.type='button';restart.className='panel-item';
restart.title='Kali 데스크톱 튜토리얼 다시 시작';
restart.innerHTML='<span class="ob-help-icon" aria-hidden="true">?</span><span class="ob-help-label">튜토리얼</span>';
panel.insertBefore(restart,panel.firstElementChild);
restart.addEventListener('click',()=>start());
const appList=document.querySelector('.menu-apps');
if(appList){
 const b=document.createElement('button');b.id='onboard-menu-entry';b.type='button';
 b.dataset.groups='favorites all';b.dataset.appName='guided desktop tour kali linux tutorial 튜토리얼';
 b.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3m0 3v1"/></svg>Guided Desktop Tour';
 b.addEventListener('click',()=>start());appList.append(b);
}
let active=false,index=0,frame=0,originalCourse=null;
const done=()=>{try{return localStorage.getItem(KEY)==='yes'}catch(_){return false}};
const markDone=()=>{try{localStorage.setItem(KEY,'yes')}catch(_){}};
function resetDesktop(){
 document.querySelectorAll('.window').forEach(w=>{w.classList.add('hidden');w.classList.remove('minimized')});
 $('menu-panel').classList.remove('open');$('menu-btn').setAttribute('aria-expanded','false');
 $('mission').classList.remove('show','hide-on-desktop');$('shell-input').blur();
}
function start(){
 if(!$('power-layer').hidden)return;
 originalCourse=window.KaliCurriculum?.snapshot()?.active||null;
 active=true;index=0;resetDesktop();toggleChapters(false);root.hidden=false;document.dispatchEvent(new Event('kali-sim:tour-started'));show();
}
function end(mark=true){
 if(mark){markDone();setCheckpoint(0)}
 toggleChapters(false);
 active=false;root.hidden=true;root.classList.remove('is-center');
 if(originalCourse&&window.KaliCurriculum?.snapshot()?.active!==originalCourse)window.KaliCurriculum.selectTrack(originalCourse);
 originalCourse=null;document.dispatchEvent(new Event('kali-sim:tour-ended'));
 $('menu-panel').classList.remove('open');$('menu-btn').setAttribute('aria-expanded','false');
 $('mission').classList.remove('show');
 // After onboarding or skip, open the terminal for the first lab mission.
 if(mark&&$('power-layer').hidden){
   const terminalLauncher=document.querySelector('.desktop-shortcuts [data-open="terminal"]');
   if(terminalLauncher)terminalLauncher.click();
 }
}
function proceed(){
 if(!active)return;
 if(index===stages.length-1){document.dispatchEvent(new Event('kali-sim:tour-completion'));return}
 index++;show();
}
function center(){
 const ww=card.offsetWidth,hh=card.offsetHeight;
 card.style.left=Math.round(Math.max(8,(innerWidth-ww)/2))+'px';
 card.style.top=Math.round(Math.max(8,(innerHeight-hh)/2))+'px';
}
function displayedTarget(s){
 if(s.target==='#wifi .net.target button'&&!document.querySelector(s.target)
   &&window.KaliNetwork&&!window.KaliNetwork.ap.online)
  return '#sim-ap-power';
 return s.target;
}
function prepareWifiTour(s){
 if(!s.target||!s.target.startsWith('#wifi')&&!['#net-info','#sim-radio','#sim-reconnect','#sim-station-connect','#nets'].includes(s.target))return;
 const advanced=$('sim-radio');
 if(advanced){
  // Keep the long control form out of the way of the AP list and its Info button.
  if(s.target==='#wifi .net.target button'||s.target==='#net-info')
   advanced.open=!!(window.KaliNetwork&&!window.KaliNetwork.ap.online);
  if(['#sim-radio','#sim-reconnect','#sim-station-connect'].includes(s.target))
   advanced.open=true;
 }
}
function scrollTourTarget(target){
 if(!target)return;
 const area=target.closest('#wifi .window-body');
 if(!area)return;
 const a=area.getBoundingClientRect(),r=target.getBoundingClientRect();
 if(r.top<a.top+5||r.bottom>a.bottom-5){
  target.scrollIntoView({block:'nearest',inline:'nearest'});
 }
}
function place(){
 if(!active)return;
 const s=stages[index],selector=displayedTarget(s),target=selector?document.querySelector(selector):null;
 scrollTourTarget(target);
 if(!target||!target.getClientRects().length||getComputedStyle(target).visibility==='hidden'){
  root.classList.add('is-center');center();return;
 }
 root.classList.remove('is-center');
 const r=target.getBoundingClientRect(),W=innerWidth,H=innerHeight,pad=6;
 spot.style.left=Math.round(Math.max(2,r.left-pad))+'px';
 spot.style.top=Math.round(Math.max(2,r.top-pad))+'px';
 spot.style.width=Math.round(Math.min(W-4,r.width+pad*2))+'px';
 spot.style.height=Math.round(Math.min(H-4,r.height+pad*2))+'px';
 const cw=card.offsetWidth,ch=card.offsetHeight,gap=14;
 let x=Math.max(8,(W-cw)/2),y=8;
 if(r.right+gap+cw<W-8){x=r.right+gap;y=r.top}
 else if(r.left-gap-cw>8){x=r.left-gap-cw;y=r.top}
 else if(r.bottom+gap+ch<H-8){y=r.bottom+gap}
 else if(r.top-ch-gap>8){y=r.top-ch-gap}
 else y=r.top>H/2?8:H-ch-8;
 card.style.left=Math.round(Math.max(8,Math.min(W-cw-8,x)))+'px';
 card.style.top=Math.round(Math.max(8,Math.min(H-ch-8,y)))+'px';
}
function schedule(){if(frame)cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{frame=0;place()})}
function show(){
 if(!active)return;
 const s=stages[index],action=['click','command','change'].includes(s.mode);
 prepareWifiTour(s);
 const chap=chapterOf(index);
 if(index>0)setCheckpoint(chap);
 $('ob-resume').hidden=!(index===0&&checkpoint()>0);
 $('onboard-card').querySelector('.ob-brand').textContent=index<26?'KALI · LINUX DESKTOP':index<46?'KALI · LEARNING CENTER':index<54?'KALI · FIREFOX SIM':index<69?'KALI · VIRTUAL NETWORK':'KALI · TOOLS & SHORTCUTS';
 $('ob-title').textContent=s.title;$('ob-body').textContent=s.body;
 $('ob-number').textContent=String(index+1).padStart(2,'0')+' / '+stages.length;
 $('ob-progress').style.width=(100*(index+1)/stages.length)+'%';
 $('ob-learn').hidden=!s.tip;$('ob-learn').textContent=s.tip||'';
 $('ob-action').hidden=!action;$('ob-action-text').textContent=s.hint||'직접 눌러 보세요.';
 if(s.target==='#wifi .net.target button'&&window.KaliNetwork&&!window.KaliNetwork.ap.online){
  $('ob-title').textContent='Wi-Fi 공유기가 꺼져 있어요';
  $('ob-body').textContent='LAB-TRAINING 공유기가 꺼져 정보 보기 버튼이 보이지 않네요. 가상 네트워크 제어판에서 전원을 켜면 버튼이 다시 나타나요.';
  $('ob-action-text').textContent='전원을 켠 다음 LAB-TRAINING 정보 보기를 눌러주세요.';
 }
 next.hidden=action;next.textContent=s.next||'다음';
 if(s.target==='#mission'&&innerWidth<=760)$('mission').classList.add('show');
 requestAnimationFrame(()=>requestAnimationFrame(place));
}
next.addEventListener('click',proceed);
$('ob-skip').addEventListener('click',()=>end(true));
document.addEventListener('click',e=>{
 if(!active)return;
 const step=stages[index];if(step.mode!=='click')return;
 const selector=displayedTarget(step);
 const target=selector?e.target.closest(selector):null;if(!target)return;
 // Turning on the offline practice AP is a prerequisite, not completion of the Info step.
 if(step.target==='#wifi .net.target button'&&selector==='#sim-ap-power')return;
 setTimeout(()=>{
  if(!active||stages[index]!==step)return;
  if(step.target==='#course-close'){
   if(originalCourse&&window.KaliCurriculum?.snapshot()?.active!==originalCourse)
    window.KaliCurriculum.selectTrack(originalCourse);
   // New tour chapter starts from a clean desktop; avoid terminal occluding shortcuts on mobile.
   $('terminal').classList.add('hidden');
  }
  proceed();
 },100);
},true);
document.addEventListener('submit',e=>{
 if(!active||stages[index].mode!=='command'||e.target.id!=='shell-form')return;
 if($('shell-input').value.trim().toLowerCase()==='help'){
  const step=stages[index];setTimeout(()=>{if(active&&stages[index]===step)proceed()},150);
 }
},true);
document.addEventListener('change',e=>{
 if(!active||stages[index].mode!=='change'||e.target.id!=='wallpaper-choice'||e.target.value==='default')return;
 const step=stages[index];setTimeout(()=>{if(active&&stages[index]===step)proceed()},120);
},true);
document.addEventListener('kali-sim:network-changed',()=>{
 if(active&&stages[index]?.target==='#wifi .net.target button')setTimeout(()=>{if(active)show()},0);
});
document.addEventListener('kali-sim:booted',()=>{
 // Every power-on starts the desktop tour, even if it was completed previously.
 // The nine-stage lab coach takes over only when the tour finishes or is skipped.
 setTimeout(()=>{if($('power-layer').hidden&&!active)start()},100);
});
document.addEventListener('kali-sim:tour-finished',()=>{if(active&&index===stages.length-1)end(true)});
document.addEventListener('kali-sim:shutdown',()=>{if(active)end(false)});
window.addEventListener('resize',schedule);
document.addEventListener('scroll',schedule,true);
document.addEventListener('fullscreenchange',schedule);
window.KaliTour={get length(){return stages.length},get index(){return index},get current(){const s=stages[index];return {mode:s.mode,target:s.target||null,title:s.title}},get chapters(){return chapters.map(x=>({...x}))},restart:start,jumpToChapter};
})();
