/**
 * ===================================================
 * 수퍼베이스(Supabase) 설정 정보
 * ===================================================
 * 1. Supabase 대시보드 -> Project Settings -> API에서 확인한 값을 입력하세요.
 * 2. URL과 anon/public Key를 아래 따옴표 안에 넣어주시면 됩니다.
 */
const SUPABASE_URL = 'https://bftneifxjzuwfnnujvxf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmdG5laWZ4anp1d2ZubnVqdnhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyMzcwOTAsImV4cCI6MjEwNjgxMzA5MH0.GzOVyCD_QsWIUU3BaxWQPBm48w2lQDJ6EP3Lba1mBA8';

// Supabase 클라이언트 객체 안전하게 생성 (잘못된 URL로 인한 전체 스크립트 중단 방지)
let supabaseClient = null;
try {
  if (window.supabase && SUPABASE_URL && SUPABASE_KEY && SUPABASE_URL.startsWith('http')) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  }
} catch (err) {
  console.error('Supabase 클라이언트 초기화 오류:', err);
}

/**
 * ===================================================
 * 바이브 카페 주문서 자바스크립트 (script.js)
 * ===================================================
 * 주요 기능:
 * 1. 실시간 주문 예상 금액 계산 및 화면 표시 (calculateTotal)
 * 2. 주문서 탭 / 주문 내역 탭 전환
 * 3. 주문하기 클릭 시 Supabase 'cafe_menu03' 테이블에 데이터 저장
 * 4. 주문 저장 중 버튼 비활성화 (중복 제출 방지)
 * 5. 주문 저장 성공/실패 처리 및 확인 메시지 출력
 * 6. 다시 작성 버튼 클릭 시 주문서만 초기화
 */

// DOM(HTML 문서)이 완전히 로드된 후 스크립트를 실행합니다.
document.addEventListener('DOMContentLoaded', () => {

  // --------------------------------------------------
  // 1. 주문 데이터 저장소 (로컬 상태 변수)
  // --------------------------------------------------
  // 접수된 주문 목록을 보관하는 배열 (최신 주문이 0번 인덱스에 위치)
  let orders = [];
  // 화면 표시용 주문 번호 카운터
  let orderCounter = 0;

  // --------------------------------------------------
  // 2. DOM 요소 선택
  // --------------------------------------------------
  // 탭 관련 요소
  const tabNav = document.querySelector('.tab-nav');                     // 탭 네비게이션 컨테이너
  const tabOrderBtn = document.getElementById('tab-order-btn');         // "☕ 주문하기" 탭 버튼
  const tabHistoryBtn = document.getElementById('tab-history-btn');     // "📋 주문 내역" 탭 버튼
  const tabOrderSection = document.getElementById('tab-order');         // 주문하기 탭 본문 섹션
  const tabHistorySection = document.getElementById('tab-history');     // 주문 내역 탭 본문 섹션
  const orderCountBadge = document.getElementById('order-count-badge'); // 주문 내역 건수 배지

  // 주문서 폼 관련 요소
  const orderForm = document.getElementById('order-form');               // 주문서 폼
  const nameInput = document.getElementById('customer-name');            // 손님 이름 입력칸
  const phoneInput = document.getElementById('customer-phone');          // 전화번호 입력칸
  const beverageSelect = document.getElementById('beverage-select');      // 음료 선택 드롭다운
  const sizeRadios = document.querySelectorAll('input[name="size"]');    // 사이즈 라디오 버튼들
  const optionCheckboxes = document.querySelectorAll('input[name="options"]'); // 추가 옵션 체크박스들
  const quantityInput = document.getElementById('quantity');             // 수량 입력칸
  const requestsInput = document.getElementById('requests');             // 요청사항 텍스트에어리어
  const totalPriceDisplay = document.getElementById('total-price');       // 예상 금액 텍스트
  const orderConfirmation = document.getElementById('order-confirmation'); // 주문 완료 확인 메시지
  const submitBtn = document.getElementById('submit-btn');               // 주문하기 버튼
  const resetBtn = document.getElementById('reset-btn');                 // 다시 작성 버튼

  // 주문 내역 관련 요소
  const ordersListEl = document.getElementById('orders-list');           // 주문 카드가 나열될 컨테이너
  const ordersSummaryArea = document.getElementById('orders-summary-area'); // 하단 요약 영역 (총 금액, 삭제 버튼)
  const totalOrdersPriceEl = document.getElementById('total-orders-price'); // 총 주문 금액 표시 엘리먼트
  const clearAllOrdersBtn = document.getElementById('clear-all-orders-btn'); // "내역 모두 지우기" 버튼

  // --------------------------------------------------
  // 3. 탭 메뉴 전환 기능
  // --------------------------------------------------
  /**
   * 주문하기 탭을 활성화합니다. (알약 슬라이더가 왼쪽으로 이동)
   */
  function switchToOrderTab() {
    if (tabNav) tabNav.setAttribute('data-active', 'order');
    tabOrderBtn.classList.add('active');
    tabHistoryBtn.classList.remove('active');

    tabOrderSection.classList.remove('hidden');
    tabHistorySection.classList.add('hidden');
  }

  /**
   * 주문 내역 탭을 활성화하고 최신 목록을 렌더링합니다. (알약 슬라이더가 오른쪽으로 이동)
   */
  function switchToHistoryTab() {
    if (tabNav) tabNav.setAttribute('data-active', 'history');
    tabHistoryBtn.classList.add('active');
    tabOrderBtn.classList.remove('active');

    tabHistorySection.classList.remove('hidden');
    tabOrderSection.classList.add('hidden');

    renderOrders(); // 주문 내역 화면 새로고침
  }

  // 탭 버튼 클릭 이벤트 연결
  tabOrderBtn.addEventListener('click', switchToOrderTab);
  tabHistoryBtn.addEventListener('click', switchToHistoryTab);

  // --------------------------------------------------
  // 4. 예상 금액 계산 함수 (calculateTotal)
  // --------------------------------------------------
  /**
   * 현재 입력/선택된 폼 값을 기반으로 주문 예상 금액을 계산합니다.
   * 음료를 선택하지 않았으면 무조건 0원을 반환합니다.
   * 
   * @returns {number} 총 금액 (숫자)
   */
  function calculateTotal() {
    // 1) 선택된 음료 확인 및 가격 읽기 (data-price 속성)
    const selectedBeverageOption = beverageSelect.options[beverageSelect.selectedIndex];
    const beveragePrice = parseInt(selectedBeverageOption.getAttribute('data-price') || '0', 10);

    // 음료를 선택하지 않았거나 가격이 0원이면 총 금액 0원
    if (!beverageSelect.value || beveragePrice === 0) {
      return 0;
    }

    // 2) 선택된 사이즈 추가 금액 읽기
    const checkedSizeRadio = document.querySelector('input[name="size"]:checked');
    const sizePrice = checkedSizeRadio
      ? parseInt(checkedSizeRadio.getAttribute('data-price') || '0', 10)
      : 0;

    // 3) 체크된 추가 옵션들의 요금 합산
    const checkedOptions = document.querySelectorAll('input[name="options"]:checked');
    let optionsPrice = 0;
    checkedOptions.forEach((checkbox) => {
      optionsPrice += parseInt(checkbox.getAttribute('data-price') || '0', 10);
    });

    // 4) 수량 읽기 (최소 1 이상)
    let quantity = parseInt(quantityInput.value, 10);
    if (isNaN(quantity) || quantity < 1) {
      quantity = 1;
    }

    // 5) 최종 금액: (기본 음료 가격 + 사이즈 추가금 + 옵션 합산금) × 수량
    return (beveragePrice + sizePrice + optionsPrice) * quantity;
  }

  // --------------------------------------------------
  // 5. 실시간 금액 표시 갱신 함수
  // --------------------------------------------------
  /**
   * calculateTotal()의 계산 결과를 화면에 3자리 콤마(toLocaleString)와 함께 표시합니다.
   */
  function updatePriceDisplay() {
    const total = calculateTotal();
    totalPriceDisplay.textContent = `${total.toLocaleString()}원`;
  }

  // 입력 항목이 변경될 때마다 실시간으로 금액 재계산
  beverageSelect.addEventListener('change', updatePriceDisplay);
  sizeRadios.forEach((radio) => radio.addEventListener('change', updatePriceDisplay));
  optionCheckboxes.forEach((checkbox) => checkbox.addEventListener('change', updatePriceDisplay));
  quantityInput.addEventListener('input', updatePriceDisplay);
  quantityInput.addEventListener('change', updatePriceDisplay);

  // --------------------------------------------------
  // 6. 주문 내역 목록 렌더링 함수 (renderOrders)
  // --------------------------------------------------
  /**
   * orders 배열의 데이터를 바탕으로 주문 내역 목록을 화면에 그립니다.
   * XSS 공격을 방지하기 위해 사용자 입력 텍스트는 textContent로 안전하게 삽입합니다.
   */
  function renderOrders() {
    // 기존 목록 비우기
    ordersListEl.textContent = '';

    // 탭 상단 배지에 주문 건수 반영
    orderCountBadge.textContent = orders.length;

    // 주문 내역이 하나도 없는 경우
    if (orders.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'empty-orders';
      emptyDiv.textContent = '아직 주문 내역이 없어요 ☕';
      ordersListEl.appendChild(emptyDiv);

      // 하단 요약 영역 숨기기
      ordersSummaryArea.classList.add('hidden');
      return;
    }

    // 주문 내역이 있으면 하단 요약 영역 표시
    ordersSummaryArea.classList.remove('hidden');

    // 각 주문 건마다 카드 엘리먼트 생성
    orders.forEach((order, index) => {
      const card = document.createElement('div');
      card.className = 'order-card';

      // [우측 상단 취소 버튼]
      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'order-cancel-btn';
      cancelBtn.textContent = '취소';
      cancelBtn.addEventListener('click', () => {
        const isConfirmed = confirm(`#${order.id} 주문을 취소하시겠습니까?`);
        if (isConfirmed) {
          orders.splice(index, 1);
          renderOrders();
        }
      });
      card.appendChild(cancelBtn);

      // [1줄]: "#1 홍길동님 · 5,000원"
      const line1 = document.createElement('div');
      line1.className = 'order-card-line1';
      line1.textContent = `#${order.id} ${order.customerName}님 · ${order.price.toLocaleString()}원`;
      card.appendChild(line1);

      // [2줄]: "카페라떼 M사이즈 (샷 추가) 1잔"
      const line2 = document.createElement('div');
      line2.className = 'order-card-line2';
      const optionsText = order.options && order.options.length > 0 ? ` (${order.options.join(', ')})` : '';
      line2.textContent = `${order.beverage} ${order.size}사이즈${optionsText} ${order.quantity}잔`;
      card.appendChild(line2);

      // [3줄]: 요청사항(있을 때만) · 주문 시간
      const line3 = document.createElement('div');
      line3.className = 'order-card-line3';
      if (order.requests) {
        line3.textContent = `요청: ${order.requests} · ${order.orderTime}`;
      } else {
        line3.textContent = order.orderTime;
      }
      card.appendChild(line3);

      ordersListEl.appendChild(card);
    });

    // 총 주문 금액 및 총 건수 계산 후 요약 표시
    const totalOrdersAmount = orders.reduce((sum, item) => sum + item.price, 0);
    totalOrdersPriceEl.textContent = `총 주문 금액: ${totalOrdersAmount.toLocaleString()}원 (${orders.length}건)`;
  }

  // --------------------------------------------------
  // 7. 주문하기 (폼 제출 및 Supabase 저장) 이벤트 처리
  // --------------------------------------------------
  orderForm.addEventListener('submit', async (event) => {
    // 폼 제출 시 페이지 새로고침 방지
    event.preventDefault();

    // 1) 필수값 1: 이름 유효성 검사
    const customerName = nameInput.value.trim();
    if (!customerName) {
      alert('이름을 입력해주세요');
      nameInput.focus();
      return;
    }

    // 2) 필수값 2: 음료 선택 유효성 검사
    if (!beverageSelect.value) {
      alert('음료를 선택해주세요');
      beverageSelect.focus();
      return;
    }

    // 3) 주문 세부 데이터 추출
    const phone = phoneInput.value.trim();

    // 음료 순수 이름 및 기본 단가 (data-price)
    const selectedOption = beverageSelect.options[beverageSelect.selectedIndex];
    const beverageName = selectedOption.textContent.split(' (')[0].trim();
    const beveragePrice = parseInt(selectedOption.getAttribute('data-price') || '0', 10);

    // 사이즈 정보 (S, M, L)
    const checkedSize = document.querySelector('input[name="size"]:checked');
    const sizeValue = checkedSize ? checkedSize.value : 'M';

    // 추가 옵션 이름 배열 (예: ['샷 추가', '크림 추가'])
    const checkedOptionElements = document.querySelectorAll('input[name="options"]:checked');
    const selectedOptionNames = [];
    checkedOptionElements.forEach((optionEl) => {
      const label = document.querySelector(`label[for="${optionEl.id}"]`);
      if (label) {
        selectedOptionNames.push(label.textContent.split(' (')[0].trim());
      }
    });

    // 수량 및 요청사항
    const quantity = parseInt(quantityInput.value, 10) || 1;
    const requests = requestsInput.value.trim();

    // 총 주문 금액 계산
    const finalPrice = calculateTotal();

    // 주문 시간 (화면 표시용 예: "오후 1:25")
    const orderTime = new Date().toLocaleTimeString('ko-KR', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    // --------------------------------------------------
    // 4) Supabase 'cafe_menu03' 테이블에 데이터 저장
    // --------------------------------------------------
    // 중복 클릭 방지: 주문하기 버튼을 비활성화하고 로딩 문구 표시
    submitBtn.disabled = true;
    const originalBtnText = submitBtn.textContent;
    submitBtn.textContent = '주문 저장 중...';

    try {
      // Supabase 클라이언트가 정상적으로 초기화되었는지 확인
      if (!supabaseClient) {
        throw new Error('Supabase 클라이언트가 초기화되지 않았습니다. CDN 연결을 확인해주세요.');
      }

      // Supabase insert 쿼리 실행
      const { data, error } = await supabaseClient
        .from('cafe_menu03')
        .insert([
          {
            customer_name: customerName, // 손님 이름
            phone: phone,                 // 전화번호
            drink: beverageName,          // 음료 이름
            drink_price: beveragePrice,   // 음료 기본 가격
            size: sizeValue,              // 사이즈 (S, M, L)
            options: selectedOptionNames, // 추가 옵션 배열
            quantity: quantity,           // 수량
            request: requests,            // 요청 사항 (컬럼명: request)
            total_price: finalPrice       // 총 결제 금액
          }
        ]);

      // 에러가 반환된 경우 에러 처리 블록으로 전달
      if (error) {
        throw error;
      }

      // --------------------------------------------------
      // [저장 성공 시 처리]
      // --------------------------------------------------
      // 로컬 orders 목록에 최신 주문 추가
      orderCounter += 1;
      const newOrder = {
        id: orderCounter,
        customerName: customerName,
        beverage: beverageName,
        size: sizeValue,
        options: selectedOptionNames,
        quantity: quantity,
        requests: requests,
        price: finalPrice,
        orderTime: orderTime
      };
      orders.unshift(newOrder); // 최신 주문을 배열 맨 앞에 추가

      // 기존 주문 완료 확인 메시지 구성 및 표시
      const optionsConfirmText = selectedOptionNames.length > 0 ? ` (${selectedOptionNames.join(', ')})` : '';
      const confirmationMessage = `${customerName}님, ${beverageName} ${sizeValue}사이즈${optionsConfirmText} ${quantity}잔, 총 ${finalPrice.toLocaleString()}원 주문이 접수되었습니다!`;

      orderConfirmation.textContent = confirmationMessage;
      orderConfirmation.classList.remove('hidden');
      orderConfirmation.style.display = 'block';

      // 주문 내역 목록 화면 및 배지 동기화
      renderOrders();

      // 주문 완료 메시지로 부드럽게 스크롤 이동
      orderConfirmation.scrollIntoView({ behavior: 'smooth' });

    } catch (error) {
      // --------------------------------------------------
      // [저장 실패 시 처리]
      // --------------------------------------------------
      const detailMsg = error && error.message ? ` (${error.message})` : '';
      alert(`주문 저장에 실패했어요${detailMsg}`);
      console.error('주문 저장 에러 상세:', error);
    } finally {
      // --------------------------------------------------
      // [완료 후 공통 처리]
      // --------------------------------------------------
      // 주문하기 버튼을 다시 활성화하고 원래 문구로 복구
      submitBtn.disabled = false;
      submitBtn.textContent = originalBtnText;
    }
  });

  // --------------------------------------------------
  // 8. 내역 모두 지우기 버튼 이벤트 처리
  // --------------------------------------------------
  clearAllOrdersBtn.addEventListener('click', () => {
    if (orders.length === 0) return;

    const isConfirmed = confirm('주문 내역을 모두 지우시겠습니까?');
    if (isConfirmed) {
      orders = [];      // 모든 주문 데이터 비우기
      renderOrders();   // 비워진 화면 갱신
    }
  });

  // --------------------------------------------------
  // 9. 다시 작성 버튼 이벤트 처리 (주문서만 초기화, 주문 내역 유지)
  // --------------------------------------------------
  resetBtn.addEventListener('click', (event) => {
    event.preventDefault();

    // 폼 입력 필드 초기화
    orderForm.reset();

    // 기본 사이즈 M 선택으로 복구
    const defaultSize = document.getElementById('size-m');
    if (defaultSize) {
      defaultSize.checked = true;
    }

    // 기본 수량 1로 복구
    quantityInput.value = '1';

    // 예상 금액 0원으로 초기화
    updatePriceDisplay();

    // 주문 확인 메시지 숨기기
    orderConfirmation.textContent = '';
    orderConfirmation.classList.add('hidden');
    orderConfirmation.style.display = 'none';

    // 이름 입력칸으로 포커스
    nameInput.focus();

    // 주의: orders 배열은 건드리지 않으므로 주문 내역은 그대로 유지됩니다.
  });

  // --------------------------------------------------
  // 10. 초기 화면 설정
  // --------------------------------------------------
  updatePriceDisplay(); // 초기 예상 금액(0원) 표시
  renderOrders();       // 초기 주문 내역("아직 주문 내역이 없어요 ☕") 렌더링
});
