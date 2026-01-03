const GRID_SIZE = 15;
const CELL_SIZE = 40;
const CANVAS_SIZE = GRID_SIZE * CELL_SIZE;

const canvas = document.getElementById('pattern-canvas');
const ctx = canvas.getContext('2d');

canvas.width = CANVAS_SIZE;
canvas.height = CANVAS_SIZE;

// 각 셀의 레이어 상태를 저장 (15x15 그리드)
const grid = Array(GRID_SIZE).fill(null).map(() => 
    Array(GRID_SIZE).fill(null).map(() => ({
        whiteRect: false,
        whiteRectMaxGrid: 4, // 흰색 직사각형의 확장 그리드 (기본값: 4칸)
        greenRect: false,
        greenRectMaxGrid: 4, // 녹색 직사각형의 확장 그리드 (기본값: 4칸)
        horizontal: false,
        horizontalFixed: false, // 가로 대시 고정 여부
        horizontal1xFull: false, // 가로 대시 1x 모드
        vertical: false,
        verticalFixed: false, // 세로 대시 고정 여부
        vertical1xFull: false, // 세로 대시 1x 모드
        dot: false,
        dotSize: 1 // dot 크기 (1: 1x, 4: 4x, 8: 8x)
    }))
);

// 레이어 표시 여부
const layerVisibility = {
    whiteRect: true,
    greenRect: true,
    horizontal: true,
    vertical: true,
    dot: true
};

// 레이어별 색상 (현재 HTML에 설정된 값으로 기본 설정)
const layerColors = {
    whiteRect: '#ffffff',
    greenRect: '#00ff85',
    horizontal: '#ffffff', // HTML에서 설정된 값
    vertical: '#00ff85',   // Slash (/)
    dot: '#ff3c32'
};

// 배경 컬러
let backgroundColor = '#000000';

// 레이어별 최대 확장 그리드 (기본값: 4칸)
const layerMaxGrid = {
    whiteRect: 4,
    greenRect: 4
};

// 현재 선택된 도구
let currentTool = 'whiteRect4';
let isDrawing = false;
let isEraseMode = false; // 지우기 모드
let isRecording = false; // 화면 녹화 중
let mediaRecorder = null;
let recordedChunks = [];

// 그리드 타입: 'square' (정사각형) 또는 'triangle' (1:2 비율 이등변 삼각형)
let gridType = 'square';

// Undo 히스토리
const undoHistory = [];

// 도구별 확장 그리드 매핑
const toolMaxGrid = {
    whiteRect4: 4,
    whiteRect2: 2,
    whiteRect1: 1,
    greenRect4: 4,
    greenRect2: 2,
    greenRect1: 1
};

// 애니메이션 변수
let animationTime = 0;
let animationId = null;

// 오디오 관련 변수
let audioContext = null;
let musicMode = false;

// 각 레이어별 오디오 정보
const layerAudio = {
    whiteRect: {
        element: null,
        source: null,
        analyser: null,
        dataArray: null,
        isPlaying: false
    },
    greenRect: {
        element: null,
        source: null,
        analyser: null,
        dataArray: null,
        isPlaying: false
    },
    horizontal: {
        element: null,
        source: null,
        analyser: null,
        dataArray: null,
        isPlaying: false
    },
    vertical: {
        element: null,
        source: null,
        analyser: null,
        dataArray: null,
        isPlaying: false
    },
    dot: {
        element: null,
        source: null,
        analyser: null,
        dataArray: null,
        isPlaying: false
    }
};

// 3x3 패턴 구조 (이미지 참고)
// 15x15 그리드를 5x5 블록으로 나누어 3x3 패턴 생성
const PATTERN_SIZE = 3;
const BLOCK_SIZE = GRID_SIZE / PATTERN_SIZE; // 5

// 주파수 대역별 레이어 매핑
const frequencyBands = {
    low: { start: 0, end: 85 },      // 저주파 - 녹색 직사각형
    mid: { start: 85, end: 340 },    // 중주파 - 흰색 직사각형
    high: { start: 340, end: 1024 } // 고주파 - 대시, 점
};

// 레이어 체크박스 이벤트
document.getElementById('layer-white-rect').addEventListener('change', (e) => {
    layerVisibility.whiteRect = e.target.checked;
    draw();
});

document.getElementById('layer-green-rect').addEventListener('change', (e) => {
    layerVisibility.greenRect = e.target.checked;
    draw();
});

document.getElementById('layer-horizontal').addEventListener('change', (e) => {
    layerVisibility.horizontal = e.target.checked;
    draw();
});

document.getElementById('layer-vertical').addEventListener('change', (e) => {
    layerVisibility.vertical = e.target.checked;
    draw();
});

document.getElementById('layer-dot').addEventListener('change', (e) => {
    layerVisibility.dot = e.target.checked;
    draw();
});

// 색상 입력 필드 이벤트
document.getElementById('color-white-rect').addEventListener('input', (e) => {
    layerColors.whiteRect = e.target.value;
    draw();
});

document.getElementById('color-green-rect').addEventListener('input', (e) => {
    layerColors.greenRect = e.target.value;
    draw();
});

document.getElementById('color-horizontal').addEventListener('input', (e) => {
    layerColors.horizontal = e.target.value;
    draw();
});

document.getElementById('color-vertical').addEventListener('input', (e) => {
    layerColors.vertical = e.target.value;
    draw();
});

document.getElementById('color-dot').addEventListener('input', (e) => {
    layerColors.dot = e.target.value;
    draw();
});

// 도구 선택 (클릭으로 토글)
canvas.addEventListener('mousedown', (e) => {
    // 음악 모드와 관계없이 수동 그리기 가능
    
    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / CELL_SIZE);
    const y = Math.floor((e.clientY - rect.top) / CELL_SIZE);
    
    if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
        toggleCell(x, y);
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (!isDrawing) return; // 음악 모드와 관계없이 수동 그리기 가능
    
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / CELL_SIZE);
    const y = Math.floor((e.clientY - rect.top) / CELL_SIZE);
    
    if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
        toggleCell(x, y);
    }
});

canvas.addEventListener('mouseup', () => {
    isDrawing = false;
});

canvas.addEventListener('mouseleave', () => {
    isDrawing = false;
});

// 키보드로 도구 선택
document.addEventListener('keydown', (e) => {
    let toolChanged = false;
    switch(e.key) {
        case '1':
            // 기본적으로 1-1 (4칸) 선택
            currentTool = 'whiteRect4';
            toolChanged = true;
            break;
        case '2':
            // 기본적으로 2-1 (4칸) 선택
            currentTool = 'greenRect4';
            toolChanged = true;
            break;
        case '3':
            // 기본적으로 horizontal 1x 선택
            currentTool = 'horizontal1x';
            toolChanged = true;
            break;
        case '4':
            // 기본적으로 vertical 1x 선택
            currentTool = 'vertical1x';
            toolChanged = true;
            break;
        case '5':
            currentTool = 'dot';
            toolChanged = true;
            break;
    }
    if (toolChanged) {
        document.querySelectorAll('.tool-btn').forEach(b => {
            b.classList.remove('active');
            if (b.dataset.tool === currentTool) {
                b.classList.add('active');
            }
        });
        updateToolIndicator();
    }
});

// 셀 토글
function toggleCell(x, y) {
    const cell = grid[y][x];
    
    // 이전 상태를 히스토리에 저장 (깊은 복사)
    const previousState = {
        x: x,
        y: y,
        whiteRect: cell.whiteRect,
        whiteRectMaxGrid: cell.whiteRectMaxGrid,
        greenRect: cell.greenRect,
        greenRectMaxGrid: cell.greenRectMaxGrid,
        horizontal: cell.horizontal,
        horizontalFixed: cell.horizontalFixed,
        horizontal1xFull: cell.horizontal1xFull,
        vertical: cell.vertical,
        verticalFixed: cell.verticalFixed,
        vertical1xFull: cell.vertical1xFull,
        dot: cell.dot,
        dotSize: cell.dotSize
    };
    
    // 지우기 모드일 때는 해당 셀의 모든 요소를 지움
    if (isEraseMode) {
        cell.whiteRect = false;
        cell.greenRect = false;
        cell.horizontal = false;
        cell.horizontalFixed = false;
        cell.horizontal1xFull = false;
        cell.vertical = false;
        cell.verticalFixed = false;
        cell.vertical1xFull = false;
        cell.dot = false;
        cell.dotSize = 1;
    } else {
        // 현재 도구에 해당하는 레이어 토글
    if (currentTool === 'whiteRect4' || currentTool === 'whiteRect2' || currentTool === 'whiteRect1') {
        cell.whiteRect = !cell.whiteRect;
        if (cell.whiteRect) {
            // 확장 그리드 정보 저장
            cell.whiteRectMaxGrid = toolMaxGrid[currentTool];
        }
    } else if (currentTool === 'greenRect4' || currentTool === 'greenRect2' || currentTool === 'greenRect1') {
        cell.greenRect = !cell.greenRect;
        if (cell.greenRect) {
            // 확장 그리드 정보 저장
            cell.greenRectMaxGrid = toolMaxGrid[currentTool];
        }
    } else if (currentTool === 'horizontal1x') {
        cell.horizontal = !cell.horizontal;
        cell.horizontalFixed = false;
        cell.horizontal1xFull = false;
    } else if (currentTool === 'horizontal1xFull') {
        cell.horizontal = !cell.horizontal;
        cell.horizontalFixed = false;
        cell.horizontal1xFull = true; // 1x 모드 표시
    } else if (currentTool === 'horizontalFixed') {
        cell.horizontal = !cell.horizontal;
        cell.horizontalFixed = true;
        cell.horizontal1xFull = false;
    } else if (currentTool === 'vertical1x') {
        cell.vertical = !cell.vertical;
        cell.verticalFixed = false;
        cell.vertical1xFull = false;
    } else if (currentTool === 'vertical1xFull') {
        cell.vertical = !cell.vertical;
        cell.verticalFixed = false;
        cell.vertical1xFull = true; // 1x 모드 표시
    } else if (currentTool === 'verticalFixed') {
        cell.vertical = !cell.vertical;
        cell.verticalFixed = true;
        cell.vertical1xFull = false;
    } else if (currentTool === 'dot1x' || currentTool === 'dot4x' || currentTool === 'dot8x') {
        cell.dot = !cell.dot;
        if (currentTool === 'dot1x') {
            cell.dotSize = 1;
        } else if (currentTool === 'dot4x') {
            cell.dotSize = 4;
        } else if (currentTool === 'dot8x') {
            cell.dotSize = 8;
        }
    }
    }
    
    // 히스토리에 추가
    undoHistory.push(previousState);
    
    // 히스토리 크기 제한 (최대 100개)
    if (undoHistory.length > 100) {
        undoHistory.shift();
    }
    
    draw();
}

// 대칭 셀 좌표 계산 (왼쪽 상단-오른쪽 하단 대각선 기준)
function getSymmetricCell(x, y) {
    // 대각선 대칭: (x, y) -> (14-y, 14-x)
    const symX = GRID_SIZE - 1 - y;
    const symY = GRID_SIZE - 1 - x;
    return { x: symX, y: symY };
}

// 레이어별 애니메이션 속도
const layerAnimationSpeed = {
    whiteRect: 1.0,
    greenRect: 1.0,
    horizontal: 1.0,
    vertical: 1.0,
    dot: 1.0
};

// 각 레이어별 음악 에너지 스무딩을 위한 변수
const smoothedEnergy = {
    whiteRect: { value: 0, target: 0 },
    greenRect: { value: 0, target: 0 },
    horizontal: { value: 0, target: 0 },
    vertical: { value: 0, target: 0 },
    dot: { value: 0, target: 0 }
};

// 각 셀별 음악 에너지 스무딩을 위한 변수 (그리드별 시간차를 위해)
const cellSmoothedEnergy = {};

// 셀의 애니메이션 값 계산 (대칭 셀과 동일한 값 사용)
function getAnimationValue(x, y, layer = null) {
    // 음악 모드일 때는 음악 에너지를 직접 사용
    if (musicMode && layer) {
        const audioInfo = layerAudio[layer];
        // 해당 레이어에 음악이 로드되어 있고 재생 중일 때만 음악 에너지 사용
        if (audioInfo && audioInfo.element && audioInfo.isPlaying) {
            const energy = getLayerEnergy(layer);
            let normalizedEnergy = 0;
            
            // 레이어별로 적절한 주파수 대역 사용
            if (layer === 'whiteRect') {
                normalizedEnergy = Math.min(1.0, energy.mid / 50); // 중주파
            } else if (layer === 'greenRect') {
                normalizedEnergy = Math.min(1.0, energy.low / 50); // 저주파
            } else if (layer === 'horizontal' || layer === 'vertical') {
                normalizedEnergy = Math.min(1.0, energy.mid / 50); // 중주파
            } else if (layer === 'dot') {
                normalizedEnergy = Math.min(1.0, energy.high / 50); // 고주파
            }
            
            // 각 셀별로 시간차를 주기 위해 위치 기반 오프셋 적용
            const sym = getSymmetricCell(x, y);
            const useSym = (x + y) > (sym.x + sym.y) || ((x + y) === (sym.x + sym.y) && x > sym.x);
            const refX = useSym ? sym.x : x;
            const refY = useSym ? sym.y : y;
            
            // 모든 레이어에 중앙에서부터 파동 효과 적용
            // 그리드 중앙 좌표
            const centerX = (GRID_SIZE - 1) / 2;
            const centerY = (GRID_SIZE - 1) / 2;
            // 중앙에서의 거리 (유클리드 거리)
            const distance = Math.sqrt(
                Math.pow(refX - centerX, 2) + Math.pow(refY - centerY, 2)
            );
            // 거리에 따라 시간 오프셋 적용 (파동 효과)
            // 레이어별로 다른 파동 속도 적용
            let waveSpeed = 1.2; // 기본 파동 속도 (더 빠르게)
            if (layer === 'dot') {
                waveSpeed = 1.2; // dot은 빠른 파동
            } else if (layer === 'whiteRect' || layer === 'greenRect') {
                waveSpeed = 1.0; // 직사각형은 중간 속도
            } else if (layer === 'horizontal' || layer === 'vertical') {
                waveSpeed = 1.1; // 대시는 약간 빠른 속도
            }
            const positionOffset = distance * waveSpeed; // 거리가 멀수록 늦게 시작
            
            const timeOffset = animationTime * 0.5 + positionOffset; // 시간에 따른 오프셋
            
            // 오프셋을 적용한 에너지 (sin 파형으로 부드럽게 변조)
            const energyModulation = (Math.sin(timeOffset) + 1) / 2; // 0~1 사이
            const modulatedEnergy = normalizedEnergy * (0.3 + 0.7 * energyModulation); // 최소 30% 유지
            
            // 셀별 스무딩 키 생성
            const cellKey = `${x}_${y}_${layer}`;
            if (!cellSmoothedEnergy[cellKey]) {
                cellSmoothedEnergy[cellKey] = { value: 0, target: 0 };
            }
            
            // 스무딩 적용 (더 부드러운 전환)
            cellSmoothedEnergy[cellKey].target = modulatedEnergy;
            // 선형 보간으로 부드럽게 전환 (스무딩 계수 감소로 더 부드럽게)
            cellSmoothedEnergy[cellKey].value += (cellSmoothedEnergy[cellKey].target - cellSmoothedEnergy[cellKey].value) * 0.05;
            
            return cellSmoothedEnergy[cellKey].value;
        }
        // 음악이 없으면 기본 애니메이션 사용 (아래 코드로 fallback)
    }
    
    // 음악 모드가 아닐 때는 기존 sin 함수 사용
    // 대칭 셀과 원본 셀 중 더 작은 인덱스를 사용하여 동일한 애니메이션 값 보장
    const sym = getSymmetricCell(x, y);
    // 대칭 셀과 원본 셀 중 하나를 선택 (항상 같은 선택)
    const useSym = (x + y) > (sym.x + sym.y) || ((x + y) === (sym.x + sym.y) && x > sym.x);
    const refX = useSym ? sym.x : x;
    const refY = useSym ? sym.y : y;
    
    // 모든 레이어에 중앙에서부터 파동 효과 적용
    // 그리드 중앙 좌표
    const centerX = (GRID_SIZE - 1) / 2;
    const centerY = (GRID_SIZE - 1) / 2;
    // 중앙에서의 거리 (유클리드 거리)
    const distance = Math.sqrt(
        Math.pow(refX - centerX, 2) + Math.pow(refY - centerY, 2)
    );
    // 거리에 따라 시간 오프셋 적용 (파동 효과)
    // 레이어별로 다른 파동 속도 적용
    let waveSpeed = 0.8; // 기본 파동 속도 (더 빠르게)
    if (layer === 'dot') {
        waveSpeed = 0.8; // dot은 빠른 파동
    } else if (layer === 'whiteRect' || layer === 'greenRect') {
        waveSpeed = 0.7; // 직사각형은 중간 속도
    } else if (layer === 'horizontal' || layer === 'vertical') {
        waveSpeed = 0.75; // 대시는 약간 빠른 속도
    }
    const offset = distance * waveSpeed; // 거리가 멀수록 늦게 시작
    
    // 레이어별 속도 조절
    const speed = layer ? layerAnimationSpeed[layer] : 1.0;
    const time = animationTime * speed;
    
    return (Math.sin(time + offset) + 1) / 2; // 0~1 사이
}

// 그리기 함수
function draw(drawBackground = true) {
    if (drawBackground) {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    } else {
        // 배경을 그리지 않을 때는 투명하게 처리 (이미 투명한 상태)
        ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    }
    
    // 그리드 라인 (녹화 중일 때는 숨김)
    if (!isRecording) {
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 1;
        
        if (gridType === 'square') {
            // 정사각형 그리드
            for (let i = 0; i <= GRID_SIZE; i++) {
                ctx.beginPath();
                ctx.moveTo(i * CELL_SIZE, 0);
                ctx.lineTo(i * CELL_SIZE, CANVAS_SIZE);
                ctx.stroke();
                
                ctx.beginPath();
                ctx.moveTo(0, i * CELL_SIZE);
                ctx.lineTo(CANVAS_SIZE, i * CELL_SIZE);
                ctx.stroke();
            }
        } else if (gridType === 'triangle') {
            // 1:2 비율 이등변 삼각형 그리드
            const triangleWidth = CELL_SIZE; // 가로
            const triangleHeight = CELL_SIZE * 2; // 세로 (1:2 비율)
            
            // 세로 라인
            for (let i = 0; i <= GRID_SIZE; i++) {
                ctx.beginPath();
                ctx.moveTo(i * triangleWidth, 0);
                ctx.lineTo(i * triangleWidth, CANVAS_SIZE);
                ctx.stroke();
            }
            
            // 가로 라인과 대각선 (삼각형 패턴)
            for (let y = 0; y < GRID_SIZE; y++) {
                for (let x = 0; x < GRID_SIZE; x++) {
                    const cellX = x * triangleWidth;
                    const cellY = y * triangleHeight;
                    
                    // 가로 라인 (셀 상단과 하단)
                    ctx.beginPath();
                    ctx.moveTo(cellX, cellY);
                    ctx.lineTo(cellX + triangleWidth, cellY);
                    ctx.stroke();
                    
                    ctx.beginPath();
                    ctx.moveTo(cellX, cellY + triangleHeight);
                    ctx.lineTo(cellX + triangleWidth, cellY + triangleHeight);
                    ctx.stroke();
                    
                    // 대각선 (삼각형을 만들기 위해)
                    // 각 셀을 두 개의 삼각형으로 나눔
                    // 왼쪽 삼각형: 위쪽 꼭짓점에서 왼쪽 아래로
                    ctx.beginPath();
                    ctx.moveTo(cellX + triangleWidth / 2, cellY); // 위쪽 중앙
                    ctx.lineTo(cellX, cellY + triangleHeight); // 왼쪽 아래
                    ctx.stroke();
                    
                    // 오른쪽 삼각형: 위쪽 꼭짓점에서 오른쪽 아래로
                    ctx.beginPath();
                    ctx.moveTo(cellX + triangleWidth / 2, cellY); // 위쪽 중앙
                    ctx.lineTo(cellX + triangleWidth, cellY + triangleHeight); // 오른쪽 아래
                    ctx.stroke();
                }
            }
        }
    }
    
    // 각 셀 그리기
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            const cell = grid[y][x];
            const cellX = x * CELL_SIZE;
            const cellY = y * CELL_SIZE;
            
            // 흰색 직사각형 - 대각선으로 길어짐 (왼쪽 위 → 오른쪽 아래), 각 셀별 확장 그리드 사용
            if (layerVisibility.whiteRect && cell.whiteRect) {
                const animValue = getAnimationValue(x, y, 'whiteRect');
                ctx.strokeStyle = layerColors.whiteRect;
                ctx.lineWidth = 2;
                
                // 기본 사이즈: 1px 대각선에서 시작
                const baseHeight = CELL_SIZE * 0.25; // 세로는 절반 크기
                const baseWidth = 1; // 1px 가로에서 시작
                const maxWidth = CELL_SIZE * (cell.whiteRectMaxGrid || 4); // 셀별 확장 그리드 사용
                
                // 애니메이션에 따라 대각선 길이 변화
                const rectWidth = baseWidth + (maxWidth - baseWidth) * animValue;
                const rectHeight = baseHeight;
                
                const centerX = cellX + CELL_SIZE / 2;
                const centerY = cellY + CELL_SIZE / 2;
                
                // 대각선으로 회전된 사각형 그리기 (45도 회전)
                ctx.save();
                ctx.translate(centerX, centerY);
                ctx.rotate(Math.PI / 4); // 45도 회전
                ctx.strokeRect(
                    -rectWidth / 2,
                    -rectHeight / 2,
                    rectWidth,
                    rectHeight
                );
                ctx.restore();
            }
            
            // 녹색 직사각형 - 대각선으로 길어짐 (오른쪽 위 → 왼쪽 아래), 각 셀별 확장 그리드 사용
            if (layerVisibility.greenRect && cell.greenRect) {
                const animValue = getAnimationValue(x, y, 'greenRect');
                ctx.strokeStyle = layerColors.greenRect;
                ctx.lineWidth = 2;
                
                // 기본 사이즈: 1px 대각선에서 시작
                // 오른쪽 위 → 왼쪽 아래 대각선이므로 가로로 길어지도록 설정
                const baseHeight = CELL_SIZE * 0.25; // 세로는 절반 크기
                const baseWidth = 1; // 1px 가로에서 시작
                const maxWidth = CELL_SIZE * (cell.greenRectMaxGrid || 4); // 셀별 확장 그리드 사용
                
                // 애니메이션에 따라 대각선 길이 변화 (가로로 길어짐)
                const rectWidth = baseWidth + (maxWidth - baseWidth) * animValue;
                const rectHeight = baseHeight;
                
                const centerX = cellX + CELL_SIZE / 2;
                const centerY = cellY + CELL_SIZE / 2;
                
                // 대각선으로 회전된 사각형 그리기 (-45도 회전, 오른쪽 위 → 왼쪽 아래)
                // whiteRect와 대칭되도록 -45도 회전
                ctx.save();
                ctx.translate(centerX, centerY);
                ctx.rotate(-Math.PI / 4); // -45도 회전 (오른쪽 위 → 왼쪽 아래)
                ctx.strokeRect(
                    -rectWidth / 2,
                    -rectHeight / 2,
                    rectWidth,
                    rectHeight
                );
                ctx.restore();
            }
            
            // 대각선 대시 (왼쪽 위 → 오른쪽 아래) - 1px에서 시작해서 최대 0.5칸까지 확장
            if (layerVisibility.horizontal && cell.horizontal) {
                ctx.strokeStyle = layerColors.horizontal;
                ctx.lineWidth = 2;
                const baseLength = 1; // 1px에서 시작
                const maxLength = CELL_SIZE * 0.7; // 대각선이므로 약간 더 길게
                
                let dashLength;
                if (cell.horizontalFixed) {
                    // Fixed: 고정 길이 (0.25칸, 모션 없음) - 절반 길이
                    dashLength = CELL_SIZE * 0.25;
                } else if (cell.horizontal1xFull) {
                    // 1x: 애니메이션으로 길이 변화 (1px에서 1칸까지)
                    const animValue = getAnimationValue(x, y, 'horizontal');
                    const maxLength1x = CELL_SIZE * 1.0;
                    dashLength = baseLength + (maxLength1x - baseLength) * animValue;
                } else {
                    // 0.5x: 애니메이션으로 길이 변화 (1px에서 0.5칸까지)
                    const animValue = getAnimationValue(x, y, 'horizontal');
                    dashLength = baseLength + (maxLength - baseLength) * animValue;
                }
                
                const centerX = cellX + CELL_SIZE / 2;
                const centerY = cellY + CELL_SIZE / 2;
                // 대각선 길이를 x, y 성분으로 변환 (45도 각도)
                const halfLength = dashLength / Math.sqrt(2);
                ctx.beginPath();
                // 왼쪽 위 → 오른쪽 아래 대각선
                ctx.moveTo(centerX - halfLength, centerY - halfLength);
                ctx.lineTo(centerX + halfLength, centerY + halfLength);
                ctx.stroke();
            }
            
            // 대각선 대시 (오른쪽 위 → 왼쪽 아래) - 1px에서 시작해서 최대 0.5칸까지 확장
            if (layerVisibility.vertical && cell.vertical) {
                ctx.strokeStyle = layerColors.vertical;
                ctx.lineWidth = 2;
                const baseLength = 1; // 1px에서 시작
                const maxLength = CELL_SIZE * 0.7; // 대각선이므로 약간 더 길게
                
                let dashLength;
                if (cell.verticalFixed) {
                    // Fixed: 고정 길이 (0.25칸, 모션 없음) - 절반 길이
                    dashLength = CELL_SIZE * 0.25;
                } else if (cell.vertical1xFull) {
                    // 1x: 애니메이션으로 길이 변화 (1px에서 1칸까지)
                    const animValue = getAnimationValue(x, y, 'vertical');
                    const maxLength1x = CELL_SIZE * 1.0;
                    dashLength = baseLength + (maxLength1x - baseLength) * animValue;
                } else {
                    // 0.5x: 애니메이션으로 길이 변화 (1px에서 0.5칸까지)
                    const animValue = getAnimationValue(x, y, 'vertical');
                    dashLength = baseLength + (maxLength - baseLength) * animValue;
                }
                
                const centerX = cellX + CELL_SIZE / 2;
                const centerY = cellY + CELL_SIZE / 2;
                // 대각선 길이를 x, y 성분으로 변환 (45도 각도)
                const halfLength = dashLength / Math.sqrt(2);
                ctx.beginPath();
                // 오른쪽 위 → 왼쪽 아래 대각선
                ctx.moveTo(centerX + halfLength, centerY - halfLength);
                ctx.lineTo(centerX - halfLength, centerY + halfLength);
                ctx.stroke();
            }
            
            // 점 (dot) - 깜박임 효과
            if (layerVisibility.dot && cell.dot) {
                const animValue = getAnimationValue(x, y, 'dot');
                const color = layerColors.dot;
                const r = parseInt(color.slice(1, 3), 16);
                const g = parseInt(color.slice(3, 5), 16);
                const b = parseInt(color.slice(5, 7), 16);
                
                const dotSize = cell.dotSize || 1;
                const centerX = cellX + CELL_SIZE / 2;
                const centerY = cellY + CELL_SIZE / 2;
                
                if (dotSize === 1) {
                    // 1x: 솔리드 스타일, 깜박임 효과 (opacity 변화)
                    const opacity = animValue;
                    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
                    ctx.beginPath();
                    const radius = 3; // 1x는 고정 크기 3px
                    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
                    ctx.fill(); // 솔리드 스타일
                } else {
                    // 4x, 8x: 0.5x 크기부터 시작해서 커지는 모션 (라인 스타일)
                    const baseRadius = 1.5; // 0.5x 크기 (3px * 0.5 = 1.5px)
                    const maxRadius = 3 * dotSize; // 최대 크기
                    const radius = baseRadius + (maxRadius - baseRadius) * animValue; // 애니메이션으로 크기 변화
                    const opacity = 1; // 크기 변화 시 opacity는 1로 고정
                    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
                    ctx.stroke(); // 라인 스타일
                }
            }
        }
    }
}

// 애니메이션 속도 조절 변수
let animationSpeedMultiplier = 1.0;

// 애니메이션 루프
function animate() {
    // 음악 모드일 때만 타이밍 조절 (패턴 자동 생성 없음)
    if (musicMode) {
        updatePatternFromMusic();
        animationTime += 0.02 * animationSpeedMultiplier;
    } else {
        animationTime += 0.02; // 기본 속도
    }
    
    draw();
    animationId = requestAnimationFrame(animate);
}

// 지우기 모드 토글
document.getElementById('erase-mode').addEventListener('click', () => {
    isEraseMode = !isEraseMode;
    const eraseBtn = document.getElementById('erase-mode');
    
    if (isEraseMode) {
        eraseBtn.classList.add('active');
        eraseBtn.textContent = 'Clear (Activated)';
        // 도구 버튼 비활성화 표시
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.style.opacity = '0.5';
        });
    } else {
        eraseBtn.classList.remove('active');
        eraseBtn.textContent = 'Clear Selection';
        // 도구 버튼 활성화 표시
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.style.opacity = '1';
        });
    }
});

// 전체 지우기
document.getElementById('clear-all').addEventListener('click', () => {
    if (confirm('모든 패턴을 지우시겠습니까?')) {
        for (let y = 0; y < GRID_SIZE; y++) {
            for (let x = 0; x < GRID_SIZE; x++) {
                grid[y][x] = {
                    whiteRect: false,
                    whiteRectMaxGrid: 4,
                    greenRect: false,
                    greenRectMaxGrid: 4,
                    horizontal: false,
                    horizontalFixed: false,
                    horizontal1xFull: false,
                    vertical: false,
                    verticalFixed: false,
                    vertical1xFull: false,
                    dot: false,
                    dotSize: 0.5
                };
            }
        }
        // 히스토리도 초기화
        undoHistory.length = 0;
        draw();
    }
});

// 패턴 저장
document.getElementById('save-pattern').addEventListener('click', () => {
    const patternData = {
        version: '1.0',
        gridSize: GRID_SIZE,
        cellSize: CELL_SIZE,
        grid: grid.map(row => 
            row.map(cell => ({
                whiteRect: cell.whiteRect,
                whiteRectMaxGrid: cell.whiteRectMaxGrid,
                greenRect: cell.greenRect,
                greenRectMaxGrid: cell.greenRectMaxGrid,
                horizontal: cell.horizontal,
                horizontalFixed: cell.horizontalFixed,
                horizontal1xFull: cell.horizontal1xFull,
                vertical: cell.vertical,
                verticalFixed: cell.verticalFixed,
                vertical1xFull: cell.vertical1xFull,
                dot: cell.dot,
                dotSize: cell.dotSize
            }))
        ),
        layerColors: layerColors,
        timestamp: new Date().toISOString()
    };
    
    const json = JSON.stringify(patternData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `pattern_${new Date().toISOString().slice(0, 10)}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
});

// 패턴 불러오기 버튼
document.getElementById('load-pattern-btn').addEventListener('click', () => {
    document.getElementById('load-pattern').click();
});

// 패턴 PNG 추출 (배경 제외)
document.getElementById('export-pattern-png').addEventListener('click', () => {
    // 임시 캔버스 생성
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = CANVAS_SIZE;
    tempCanvas.height = CANVAS_SIZE;
    const tempCtx = tempCanvas.getContext('2d');
    
    // 배경을 투명하게 설정 (배경을 그리지 않음)
    tempCtx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    
    // 그리드 라인은 그리지 않음 (패턴만)
    
    // 각 셀 그리기 (기존 draw 함수의 패턴 그리기 로직 재사용)
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            const cell = grid[y][x];
            const cellX = x * CELL_SIZE;
            const cellY = y * CELL_SIZE;
            
            // 흰색 직사각형
            if (layerVisibility.whiteRect && cell.whiteRect) {
                const animValue = getAnimationValue(x, y, 'whiteRect');
                tempCtx.strokeStyle = layerColors.whiteRect;
                tempCtx.lineWidth = 2;
                
                const baseHeight = CELL_SIZE * 0.25;
                const baseWidth = 1;
                const maxWidth = CELL_SIZE * (cell.whiteRectMaxGrid || 4);
                
                const rectWidth = baseWidth + (maxWidth - baseWidth) * animValue;
                const rectHeight = baseHeight;
                
                const centerX = cellX + CELL_SIZE / 2;
                const centerY = cellY + CELL_SIZE / 2;
                
                tempCtx.save();
                tempCtx.translate(centerX, centerY);
                tempCtx.rotate(Math.PI / 4);
                tempCtx.strokeRect(
                    -rectWidth / 2,
                    -rectHeight / 2,
                    rectWidth,
                    rectHeight
                );
                tempCtx.restore();
            }
            
            // 녹색 직사각형
            if (layerVisibility.greenRect && cell.greenRect) {
                const animValue = getAnimationValue(x, y, 'greenRect');
                tempCtx.strokeStyle = layerColors.greenRect;
                tempCtx.lineWidth = 2;
                
                const baseHeight = CELL_SIZE * 0.25;
                const baseWidth = 1;
                const maxWidth = CELL_SIZE * (cell.greenRectMaxGrid || 4);
                
                const rectWidth = baseWidth + (maxWidth - baseWidth) * animValue;
                const rectHeight = baseHeight;
                
                const centerX = cellX + CELL_SIZE / 2;
                const centerY = cellY + CELL_SIZE / 2;
                
                tempCtx.save();
                tempCtx.translate(centerX, centerY);
                tempCtx.rotate(-Math.PI / 4);
                tempCtx.strokeRect(
                    -rectWidth / 2,
                    -rectHeight / 2,
                    rectWidth,
                    rectHeight
                );
                tempCtx.restore();
            }
            
            // 대각선 대시 (왼쪽 위 → 오른쪽 아래)
            if (layerVisibility.horizontal && cell.horizontal) {
                tempCtx.strokeStyle = layerColors.horizontal;
                tempCtx.lineWidth = 2;
                const baseLength = 1;
                const maxLength = CELL_SIZE * 0.7;
                
                let dashLength;
                if (cell.horizontalFixed) {
                    dashLength = CELL_SIZE * 0.25;
                } else if (cell.horizontal1xFull) {
                    const animValue = getAnimationValue(x, y, 'horizontal');
                    const maxLength1x = CELL_SIZE * 1.0;
                    dashLength = baseLength + (maxLength1x - baseLength) * animValue;
                } else {
                    const animValue = getAnimationValue(x, y, 'horizontal');
                    dashLength = baseLength + (maxLength - baseLength) * animValue;
                }
                
                const centerX = cellX + CELL_SIZE / 2;
                const centerY = cellY + CELL_SIZE / 2;
                const halfLength = dashLength / Math.sqrt(2);
                tempCtx.beginPath();
                tempCtx.moveTo(centerX - halfLength, centerY - halfLength);
                tempCtx.lineTo(centerX + halfLength, centerY + halfLength);
                tempCtx.stroke();
            }
            
            // 대각선 대시 (오른쪽 위 → 왼쪽 아래)
            if (layerVisibility.vertical && cell.vertical) {
                tempCtx.strokeStyle = layerColors.vertical;
                tempCtx.lineWidth = 2;
                const baseLength = 1;
                const maxLength = CELL_SIZE * 0.7;
                
                let dashLength;
                if (cell.verticalFixed) {
                    dashLength = CELL_SIZE * 0.25;
                } else if (cell.vertical1xFull) {
                    const animValue = getAnimationValue(x, y, 'vertical');
                    const maxLength1x = CELL_SIZE * 1.0;
                    dashLength = baseLength + (maxLength1x - baseLength) * animValue;
                } else {
                    const animValue = getAnimationValue(x, y, 'vertical');
                    dashLength = baseLength + (maxLength - baseLength) * animValue;
                }
                
                const centerX = cellX + CELL_SIZE / 2;
                const centerY = cellY + CELL_SIZE / 2;
                const halfLength = dashLength / Math.sqrt(2);
                tempCtx.beginPath();
                tempCtx.moveTo(centerX + halfLength, centerY - halfLength);
                tempCtx.lineTo(centerX - halfLength, centerY + halfLength);
                tempCtx.stroke();
            }
            
            // 점 (dot)
            if (layerVisibility.dot && cell.dot) {
                const animValue = getAnimationValue(x, y, 'dot');
                const color = layerColors.dot;
                const r = parseInt(color.slice(1, 3), 16);
                const g = parseInt(color.slice(3, 5), 16);
                const b = parseInt(color.slice(5, 7), 16);
                
                const dotSize = cell.dotSize || 1;
                const centerX = cellX + CELL_SIZE / 2;
                const centerY = cellY + CELL_SIZE / 2;
                
                if (dotSize === 1) {
                    const opacity = animValue;
                    tempCtx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
                    tempCtx.beginPath();
                    const radius = 3;
                    tempCtx.arc(centerX, centerY, radius, 0, Math.PI * 2);
                    tempCtx.fill();
                } else {
                    const baseRadius = 1.5;
                    const maxRadius = 3 * dotSize;
                    const radius = baseRadius + (maxRadius - baseRadius) * animValue;
                    const opacity = 1;
                    tempCtx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
                    tempCtx.lineWidth = 2;
                    tempCtx.beginPath();
                    tempCtx.arc(centerX, centerY, radius, 0, Math.PI * 2);
                    tempCtx.stroke();
                }
            }
        }
    }
    
    // PNG로 다운로드
    tempCanvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `pattern_${new Date().toISOString().slice(0, 10)}.png`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
    }, 'image/png');
});

// 패턴 불러오기
// 패턴 데이터 로드 함수
function loadPatternData(patternData, showAlert = true) {
    try {
        // 버전 확인
        if (!patternData.grid || !Array.isArray(patternData.grid)) {
            if (showAlert) alert('잘못된 패턴 파일입니다.');
            return;
        }
        
        // 그리드 데이터 복원
        for (let y = 0; y < Math.min(GRID_SIZE, patternData.grid.length); y++) {
            for (let x = 0; x < Math.min(GRID_SIZE, patternData.grid[y].length); x++) {
                const savedCell = patternData.grid[y][x];
                const cell = grid[y][x];
                
                if (savedCell) {
                    cell.whiteRect = savedCell.whiteRect || false;
                    cell.whiteRectMaxGrid = savedCell.whiteRectMaxGrid || 4;
                    cell.greenRect = savedCell.greenRect || false;
                    cell.greenRectMaxGrid = savedCell.greenRectMaxGrid || 4;
                    cell.horizontal = savedCell.horizontal || false;
                    cell.horizontalFixed = savedCell.horizontalFixed || false;
                    cell.horizontal1xFull = savedCell.horizontal1xFull || false;
                    cell.vertical = savedCell.vertical || false;
                    cell.verticalFixed = savedCell.verticalFixed || false;
                    cell.vertical1xFull = savedCell.vertical1xFull || false;
                    cell.dot = savedCell.dot || false;
                    cell.dotSize = savedCell.dotSize || 0.5;
                }
            }
        }
        
        // 색상 복원 (있는 경우)
        if (patternData.layerColors) {
            Object.assign(layerColors, patternData.layerColors);
            // 색상 피커 업데이트
            document.getElementById('color-white-rect').value = layerColors.whiteRect;
            document.getElementById('color-green-rect').value = layerColors.greenRect;
            document.getElementById('color-horizontal').value = layerColors.horizontal;
            document.getElementById('color-vertical').value = layerColors.vertical;
            document.getElementById('color-dot').value = layerColors.dot;
        }
        
        // 히스토리 초기화
        undoHistory.length = 0;
        
        draw();
        if (showAlert) alert('패턴을 불러왔습니다.');
    } catch (error) {
        console.error('패턴 불러오기 오류:', error);
        if (showAlert) alert('패턴 파일을 불러오는 중 오류가 발생했습니다.');
    }
}

document.getElementById('load-pattern').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        const patternData = JSON.parse(event.target.result);
        loadPatternData(patternData, true);
    };
    reader.readAsText(file);
    
    // 파일 입력 초기화 (같은 파일을 다시 선택할 수 있도록)
    e.target.value = '';
});


// 화면 녹화
document.getElementById('record-video').addEventListener('click', async () => {
    if (isRecording) {
        // 녹화 중지
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
    } else {
        // 녹화 시작
        try {
            const stream = canvas.captureStream(30); // 30fps
            recordedChunks = [];
            
            mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'video/webm;codecs=vp9'
            });
            
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    recordedChunks.push(event.data);
                }
            };
            
            mediaRecorder.onstop = () => {
                const blob = new Blob(recordedChunks, { type: 'video/webm' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.download = `pattern_${new Date().toISOString().slice(0, 10)}.webm`;
                link.href = url;
                link.click();
                URL.revokeObjectURL(url);
                
                isRecording = false;
                document.getElementById('record-video').textContent = '화면 녹화';
                document.getElementById('record-video').classList.remove('active');
            };
            
            mediaRecorder.start();
            isRecording = true;
            document.getElementById('record-video').textContent = '녹화 중지';
            document.getElementById('record-video').classList.add('active');
        } catch (error) {
            console.error('영상 녹화 오류:', error);
            alert('영상 녹화를 시작할 수 없습니다. 브라우저가 지원하지 않을 수 있습니다.');
        }
    }
});

// 도구 표시 업데이트
function updateToolIndicator() {
    // 간단한 표시 (콘솔 또는 UI에 표시 가능)
    console.log('현재 도구:', currentTool);
}

// AudioContext 초기화
function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
}

// 각 레이어별 오디오 파일 로드
document.querySelectorAll('.load-audio-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const layer = btn.dataset.layer;
        
        // 레이어 이름을 HTML ID 형식으로 변환
        const layerNameMap = {
            'whiteRect': 'white-rect',
            'greenRect': 'green-rect',
            'horizontal': 'horizontal',
            'vertical': 'vertical',
            'dot': 'dot'
        };
        
        const htmlId = layerNameMap[layer] || layer;
        const fileInput = document.getElementById(`audio-${htmlId}`);
        
        if (fileInput) {
            fileInput.click();
        }
    });
});

// 각 레이어별 파일 선택 이벤트
const layerMapping = {
    'white-rect': 'whiteRect',
    'green-rect': 'greenRect',
    'horizontal': 'horizontal',
    'vertical': 'vertical',
    'dot': 'dot'
};

Object.keys(layerMapping).forEach(layerName => {
    const layer = layerMapping[layerName];
    const fileInput = document.getElementById(`audio-${layerName}`);
    
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                loadLayerAudio(layer, file);
            }
        });
    }
});

// 레이어별 오디오 파일 로드
function loadLayerAudio(layer, file) {
    initAudioContext();
    
    const url = URL.createObjectURL(file);
    const audioInfo = layerAudio[layer];
    
    // 기존 오디오 정리
    if (audioInfo.element) {
        audioInfo.element.pause();
        if (audioInfo.source) {
            audioInfo.source.disconnect();
        }
    }
    
    // 새 오디오 생성
    audioInfo.element = new Audio(url);
    audioInfo.element.loop = true;
    
    // Analyser 설정
    audioInfo.analyser = audioContext.createAnalyser();
    audioInfo.analyser.fftSize = 2048;
    audioInfo.dataArray = new Uint8Array(audioInfo.analyser.frequencyBinCount);
    
    // Source 연결
    audioInfo.source = audioContext.createMediaElementSource(audioInfo.element);
    audioInfo.source.connect(audioInfo.analyser);
    audioInfo.analyser.connect(audioContext.destination);
    
    // 파일명 표시
    const layerNameMap = {
        'whiteRect': 'white-rect',
        'greenRect': 'green-rect',
        'horizontal': 'horizontal',
        'vertical': 'vertical',
        'dot': 'dot'
    };
    const fileNameEl = document.getElementById(`audio-name-${layerNameMap[layer]}`);
    if (fileNameEl) {
        fileNameEl.textContent = file.name;
        fileNameEl.style.color = '#4a9eff';
    }
    
    // 재생 이벤트
    audioInfo.element.addEventListener('ended', () => {
        audioInfo.isPlaying = false;
    });
    
    audioInfo.element.addEventListener('play', () => {
        audioInfo.isPlaying = true;
    });
    
    audioInfo.element.addEventListener('pause', () => {
        audioInfo.isPlaying = false;
    });
    
    // 재생바 표시
    const progressContainer = document.querySelector(`.progress-container-layer[data-layer="${layer}"]`);
    if (progressContainer) {
        progressContainer.style.display = 'block';
    }
    
    // 메타데이터 로드 이벤트
    audioInfo.element.addEventListener('loadedmetadata', () => {
        // 재생바 초기화
        const progressFill = document.querySelector(`.progress-fill-layer[data-layer="${layer}"]`);
        const timeDisplay = document.querySelector(`.time-display-layer[data-layer="${layer}"]`);
        if (progressFill && timeDisplay) {
            progressFill.style.width = '0%';
            timeDisplay.textContent = `0:00 / ${formatTime(audioInfo.element.duration)}`;
        }
    });
}

// 전체 재생/정지 토글
let isAllPlaying = false;
document.getElementById('play-pause-all').addEventListener('click', () => {
    initAudioContext();
    
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    
    if (isAllPlaying) {
        // 정지
        Object.keys(layerAudio).forEach(layer => {
            const audioInfo = layerAudio[layer];
            if (audioInfo.element) {
                audioInfo.element.pause();
                audioInfo.isPlaying = false;
            }
        });
        isAllPlaying = false;
        document.getElementById('play-pause-all').textContent = '▶';
        musicMode = false;
    } else {
        // 재생 - 모든 레이어 음악을 동일한 시간대로 동기화
        let hasAudio = false;
        let syncTime = 0; // 동기화할 시간 (0부터 시작)
        
        // 모든 음악을 동일한 시간(0초)으로 설정하고 동시에 재생
        Object.keys(layerAudio).forEach(layer => {
            const audioInfo = layerAudio[layer];
            if (audioInfo.element) {
                // 모든 음악을 0초로 리셋
                audioInfo.element.currentTime = syncTime;
                audioInfo.element.play();
                audioInfo.isPlaying = true;
                hasAudio = true;
            }
        });
        
        if (hasAudio) {
            isAllPlaying = true;
            document.getElementById('play-pause-all').textContent = '||';
            musicMode = true; // 음악 재생 시 자동으로 음악 모드 활성화
        }
    }
});

// 재생바 드래그 기능 추가
function setupProgressBarDrag() {
    // 전체 재생바
    const progressBarAll = document.getElementById('progress-all');
    if (progressBarAll) {
        setupProgressBarDragForElement(progressBarAll, null, true);
    }
    
    // 각 레이어별 재생바
    document.querySelectorAll('.progress-bar-layer').forEach(progressBar => {
        const layer = progressBar.dataset.layer;
        setupProgressBarDragForElement(progressBar, layer, false);
    });
}

function setupProgressBarDragForElement(progressBar, layer, isAll) {
    let isDragging = false;
    
    const seekToPosition = (e) => {
        const rect = progressBar.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = Math.max(0, Math.min(1, x / rect.width));
        
        if (isAll) {
            // 전체 재생바: 모든 레이어의 재생 위치 변경
            Object.keys(layerAudio).forEach(l => {
                const audioInfo = layerAudio[l];
                if (audioInfo.element && audioInfo.element.duration) {
                    audioInfo.element.currentTime = audioInfo.element.duration * percentage;
                }
            });
        } else {
            // 개별 레이어 재생바
            const audioInfo = layerAudio[layer];
            if (audioInfo.element && audioInfo.element.duration) {
                audioInfo.element.currentTime = audioInfo.element.duration * percentage;
            }
        }
    };
    
    progressBar.addEventListener('mousedown', (e) => {
        isDragging = true;
        seekToPosition(e);
    });
    
    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            seekToPosition(e);
        }
    });
    
    document.addEventListener('mouseup', () => {
        isDragging = false;
    });
    
    // 클릭으로도 이동 가능
    progressBar.addEventListener('click', (e) => {
        if (!isDragging) {
            seekToPosition(e);
        }
    });
}

// 재생바 드래그 기능 초기화
setupProgressBarDrag();

// 시간 포맷 함수
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// 재생바 업데이트
function updateProgressBars() {
    // 전체 재생바 (재생 중인 오디오들의 평균)
    let totalCurrent = 0;
    let totalDuration = 0;
    let playingCount = 0;
    let hasAnyPlaying = false;
    
    Object.keys(layerAudio).forEach(layer => {
        const audioInfo = layerAudio[layer];
        if (audioInfo.element && audioInfo.element.duration) {
            if (!audioInfo.element.paused) {
                totalCurrent += audioInfo.element.currentTime;
                totalDuration += audioInfo.element.duration;
                playingCount++;
                hasAnyPlaying = true;
            } else {
                totalDuration += audioInfo.element.duration;
            }
        }
    });
    
    // 전체 재생/정지 버튼 상태 업데이트
    const playPauseAllBtn = document.getElementById('play-pause-all');
    if (playPauseAllBtn) {
        if (hasAnyPlaying) {
            playPauseAllBtn.textContent = '||';
            isAllPlaying = true;
        } else {
            playPauseAllBtn.textContent = '▶';
            isAllPlaying = false;
        }
    }
    
    const progressFillAll = document.getElementById('progress-fill-all');
    const timeAll = document.getElementById('time-all');
    
    if (progressFillAll && timeAll) {
        if (playingCount > 0 && totalDuration > 0) {
            const avgCurrent = totalCurrent / playingCount;
            const avgDuration = totalDuration / Object.keys(layerAudio).length;
            const progress = (avgCurrent / avgDuration) * 100;
            progressFillAll.style.width = `${Math.min(progress, 100)}%`;
            timeAll.textContent = `${formatTime(avgCurrent)} / ${formatTime(avgDuration)}`;
        } else if (totalDuration > 0) {
            const avgDuration = totalDuration / Object.keys(layerAudio).length;
            progressFillAll.style.width = '0%';
            timeAll.textContent = `0:00 / ${formatTime(avgDuration)}`;
        }
    }
    
    // 각 레이어별 재생바
    Object.keys(layerAudio).forEach(layer => {
        const audioInfo = layerAudio[layer];
        if (audioInfo.element) {
            const progressFill = document.querySelector(`.progress-fill-layer[data-layer="${layer}"]`);
            const timeDisplay = document.querySelector(`.time-display-layer[data-layer="${layer}"]`);
            
            if (progressFill && timeDisplay) {
                const current = audioInfo.element.currentTime;
                const duration = audioInfo.element.duration || 0;
                
                if (duration > 0) {
                    const progress = (current / duration) * 100;
                    progressFill.style.width = `${Math.min(progress, 100)}%`;
                    timeDisplay.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
                } else {
                    progressFill.style.width = '0%';
                    timeDisplay.textContent = '0:00 / 0:00';
                }
            }
        }
    });
    
    requestAnimationFrame(updateProgressBars);
}

// 재생바 업데이트 시작
updateProgressBars();

// 패턴 초기화 (3x3 구조)
function clearAllPatterns() {
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            grid[y][x] = {
                whiteRect: false,
                whiteRectMaxGrid: 4,
                greenRect: false,
                greenRectMaxGrid: 4,
                horizontal: false,
                horizontalFixed: false,
                horizontal1xFull: false,
                vertical: false,
                verticalFixed: false,
                vertical1xFull: false,
                dot: false,
                dotSize: 0.5
            };
        }
    }
}

// 주파수 대역별 에너지 계산
function getFrequencyEnergy(data, start, end) {
    let sum = 0;
    for (let i = start; i < end && i < data.length; i++) {
        sum += data[i];
    }
    return sum / (end - start);
}

// 각 레이어별 주파수 에너지 계산
function getLayerEnergy(layer) {
    const audioInfo = layerAudio[layer];
    if (!audioInfo.analyser || !audioInfo.isPlaying) {
        return { low: 0, mid: 0, high: 0 };
    }
    
    audioInfo.analyser.getByteFrequencyData(audioInfo.dataArray);
    
    return {
        low: getFrequencyEnergy(audioInfo.dataArray, frequencyBands.low.start, frequencyBands.low.end),
        mid: getFrequencyEnergy(audioInfo.dataArray, frequencyBands.mid.start, frequencyBands.mid.end),
        high: getFrequencyEnergy(audioInfo.dataArray, frequencyBands.high.start, frequencyBands.high.end)
    };
}

// 고정 패턴 초기화 (음악 모드 시작 시 한 번만)
let patternsInitialized = false;

// 고정 패턴 초기화 함수
function initializeFixedPatterns() {
    if (patternsInitialized) return;
    
    // 15x15 그리드를 3x3 블록으로 나눔 (각 블록 5x5)
    const BLOCK_SIZE = 5;
    
    // Type A 위치: 모서리 4개 + 중앙 1개
    const typeAPositions = [
        {bx: 0, by: 0}, // 왼쪽 상단
        {bx: 2, by: 0}, // 오른쪽 상단
        {bx: 0, by: 2}, // 왼쪽 하단
        {bx: 2, by: 2}, // 오른쪽 하단
        {bx: 1, by: 1}  // 중앙
    ];
    
    // Type A 패턴: 중앙 녹색 플러스 + 3x3 흰색 직사각형 + 5x5 녹색 직사각형 + 빨간 점들
    typeAPositions.forEach(({bx, by}) => {
        const blockStartX = bx * BLOCK_SIZE;
        const blockStartY = by * BLOCK_SIZE;
        const centerX = blockStartX + Math.floor(BLOCK_SIZE / 2); // 블록 중앙 (예: 2)
        const centerY = blockStartY + Math.floor(BLOCK_SIZE / 2); // 블록 중앙 (예: 2)
        
        // 중앙 대각선 (X 형태) - 왼쪽 위에서 오른쪽 아래, 오른쪽 위에서 왼쪽 아래
        // 왼쪽 위 → 오른쪽 아래 대각선
        for (let i = -1; i <= 1; i++) {
            const px = centerX + i;
            const py = centerY + i;
            if (px >= 0 && px < GRID_SIZE && py >= 0 && py < GRID_SIZE) {
                grid[py][px].horizontal = true; // 대각선을 horizontal로 표시
            }
        }
        // 오른쪽 위 → 왼쪽 아래 대각선
        for (let i = -1; i <= 1; i++) {
            const px = centerX + i;
            const py = centerY - i;
            if (px >= 0 && px < GRID_SIZE && py >= 0 && py < GRID_SIZE) {
                grid[py][px].vertical = true; // 대각선을 vertical로 표시
            }
        }
        
        // 플러스 주변 3x3의 모서리 4개: 빨간 점들
        const innerDots = [
            {dx: -1, dy: -1}, {dx: 1, dy: -1},
            {dx: -1, dy: 1}, {dx: 1, dy: 1}
        ];
        innerDots.forEach(({dx, dy}) => {
            const px = centerX + dx;
            const py = centerY + dy;
            if (px >= 0 && px < GRID_SIZE && py >= 0 && py < GRID_SIZE) {
                grid[py][px].dot = true;
            }
        });
        
        // 3x3 흰색 직사각형 (중앙 기준 -1부터 +1까지, 즉 1,1부터 3,3까지)
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const px = centerX + dx;
                const py = centerY + dy;
                if (px >= blockStartX && px < blockStartX + BLOCK_SIZE &&
                    py >= blockStartY && py < blockStartY + BLOCK_SIZE &&
                    px >= 0 && px < GRID_SIZE && py >= 0 && py < GRID_SIZE) {
                    grid[py][px].whiteRect = true;
                }
            }
        }
        
        // 5x5 녹색 직사각형 (전체 블록)
        for (let y = blockStartY; y < blockStartY + BLOCK_SIZE && y < GRID_SIZE; y++) {
            for (let x = blockStartX; x < blockStartX + BLOCK_SIZE && x < GRID_SIZE; x++) {
                if (x >= 0 && y >= 0) {
                    grid[y][x].greenRect = true;
                }
            }
        }
        
        // 모서리 4개: 빨간 점들
        const cornerDots = [
            {x: blockStartX, y: blockStartY}, // 왼쪽 상단
            {x: blockStartX + BLOCK_SIZE - 1, y: blockStartY}, // 오른쪽 상단
            {x: blockStartX, y: blockStartY + BLOCK_SIZE - 1}, // 왼쪽 하단
            {x: blockStartX + BLOCK_SIZE - 1, y: blockStartY + BLOCK_SIZE - 1} // 오른쪽 하단
        ];
        cornerDots.forEach(({x, y}) => {
            if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
                grid[y][x].dot = true;
            }
        });
    });
    
    // Type B 위치: 상하좌우 중간 4개
    const typeBPositions = [
        {bx: 1, by: 0}, // 상단 중간
        {bx: 0, by: 1}, // 왼쪽 중간
        {bx: 2, by: 1}, // 오른쪽 중간
        {bx: 1, by: 2}  // 하단 중간
    ];
    
    // Type B 패턴: 중앙 녹색 플러스 + 주변 빨간 점 4개 + 흰색 직사각형 4개 + 녹색 직사각형 4개 + 모서리 빨간 점 4개
    typeBPositions.forEach(({bx, by}) => {
        const blockStartX = bx * BLOCK_SIZE;
        const blockStartY = by * BLOCK_SIZE;
        const centerX = blockStartX + Math.floor(BLOCK_SIZE / 2);
        const centerY = blockStartY + Math.floor(BLOCK_SIZE / 2);
        
        // 중앙 대각선 (X 형태) - 왼쪽 위에서 오른쪽 아래, 오른쪽 위에서 왼쪽 아래
        // 왼쪽 위 → 오른쪽 아래 대각선
        for (let i = -1; i <= 1; i++) {
            const px = centerX + i;
            const py = centerY + i;
            if (px >= 0 && px < GRID_SIZE && py >= 0 && py < GRID_SIZE) {
                grid[py][px].horizontal = true; // 대각선을 horizontal로 표시
            }
        }
        // 오른쪽 위 → 왼쪽 아래 대각선
        for (let i = -1; i <= 1; i++) {
            const px = centerX + i;
            const py = centerY - i;
            if (px >= 0 && px < GRID_SIZE && py >= 0 && py < GRID_SIZE) {
                grid[py][px].vertical = true; // 대각선을 vertical로 표시
            }
        }
        
        // 플러스 주변 3x3의 모서리 4개: 빨간 점들
        const innerDots = [
            {dx: -1, dy: -1}, {dx: 1, dy: -1},
            {dx: -1, dy: 1}, {dx: 1, dy: 1}
        ];
        innerDots.forEach(({dx, dy}) => {
            const px = centerX + dx;
            const py = centerY + dy;
            if (px >= 0 && px < GRID_SIZE && py >= 0 && py < GRID_SIZE) {
                grid[py][px].dot = true;
            }
        });
        
        // 플러스 바로 옆 (상하좌우): 흰색 직사각형 4개 (짧은 직사각형)
        // 위쪽 흰색 직사각형 (가로) - 플러스에서 한 칸 위
        if (centerY - 1 >= blockStartY && centerY - 1 >= 0) {
            grid[centerY - 1][centerX].whiteRect = true;
        }
        // 아래쪽 흰색 직사각형 (가로) - 플러스에서 한 칸 아래
        if (centerY + 1 < blockStartY + BLOCK_SIZE && centerY + 1 < GRID_SIZE) {
            grid[centerY + 1][centerX].whiteRect = true;
        }
        // 왼쪽 흰색 직사각형 (세로) - 플러스에서 한 칸 왼쪽
        if (centerX - 1 >= blockStartX && centerX - 1 >= 0) {
            grid[centerY][centerX - 1].whiteRect = true;
        }
        // 오른쪽 흰색 직사각형 (세로) - 플러스에서 한 칸 오른쪽
        if (centerX + 1 < blockStartX + BLOCK_SIZE && centerX + 1 < GRID_SIZE) {
            grid[centerY][centerX + 1].whiteRect = true;
        }
        
        // 가장자리 중앙: 녹색 직사각형 4개 (짧은 직사각형)
        // 상단 가장자리 중앙 (녹색 직사각형 - 가로)
        if (blockStartY >= 0 && blockStartY < GRID_SIZE) {
            grid[blockStartY][centerX].greenRect = true;
        }
        // 하단 가장자리 중앙 (녹색 직사각형 - 가로)
        const bottomY = blockStartY + BLOCK_SIZE - 1;
        if (bottomY >= 0 && bottomY < GRID_SIZE) {
            grid[bottomY][centerX].greenRect = true;
        }
        // 좌측 가장자리 중앙 (녹색 직사각형 - 세로)
        if (blockStartX >= 0 && blockStartX < GRID_SIZE) {
            grid[centerY][blockStartX].greenRect = true;
        }
        // 우측 가장자리 중앙 (녹색 직사각형 - 세로)
        const rightX = blockStartX + BLOCK_SIZE - 1;
        if (rightX >= 0 && rightX < GRID_SIZE) {
            grid[centerY][rightX].greenRect = true;
        }
        
        // 모서리 4개: 빨간 점들
        const cornerDots = [
            {x: blockStartX, y: blockStartY}, // 왼쪽 상단
            {x: blockStartX + BLOCK_SIZE - 1, y: blockStartY}, // 오른쪽 상단
            {x: blockStartX, y: blockStartY + BLOCK_SIZE - 1}, // 왼쪽 하단
            {x: blockStartX + BLOCK_SIZE - 1, y: blockStartY + BLOCK_SIZE - 1} // 오른쪽 하단
        ];
        cornerDots.forEach(({x, y}) => {
            if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
                grid[y][x].dot = true;
            }
        });
    });
    
    // 셀 사이 간격 패턴 (대각선 연결 - 왼쪽 위에서 오른쪽 아래)
    // 패턴: 흰색 직사각형 - 빨간 점 - 대각선 대시 - 빨간 점
    for (let by = 0; by < 3; by++) {
        for (let bx = 0; bx < 2; bx++) {
            const gapX = (bx + 1) * BLOCK_SIZE - 1; // 블록 사이 경계
            const centerY = by * BLOCK_SIZE + Math.floor(BLOCK_SIZE / 2);
            
            // 흰색 직사각형 (블록 경계 바로 옆, 대각선 시작점)
            if (gapX + 1 < GRID_SIZE && centerY >= 0 && centerY < GRID_SIZE) {
                grid[centerY][gapX + 1].whiteRect = true;
            }
            
            // 첫 번째 빨간 점
            if (gapX + 2 < GRID_SIZE && centerY + 1 >= 0 && centerY + 1 < GRID_SIZE) {
                grid[centerY + 1][gapX + 2].dot = true;
            }
            
            // 대각선 대시 (왼쪽 위 → 오른쪽 아래)
            if (gapX + 3 < GRID_SIZE && centerY + 2 >= 0 && centerY + 2 < GRID_SIZE) {
                grid[centerY + 2][gapX + 3].horizontal = true;
            }
            
            // 두 번째 빨간 점
            if (gapX + 4 < GRID_SIZE && centerY + 3 >= 0 && centerY + 3 < GRID_SIZE) {
                grid[centerY + 3][gapX + 4].dot = true;
            }
        }
    }
    
    // 셀 사이 간격 패턴 (대각선 연결 - 오른쪽 위에서 왼쪽 아래)
    // 패턴: 흰색 직사각형 - 빨간 점 - 대각선 대시 - 빨간 점
    for (let bx = 0; bx < 3; bx++) {
        for (let by = 0; by < 2; by++) {
            const gapY = (by + 1) * BLOCK_SIZE - 1; // 블록 사이 경계
            const centerX = bx * BLOCK_SIZE + Math.floor(BLOCK_SIZE / 2);
            
            // 흰색 직사각형 (블록 경계 바로 아래, 대각선 시작점)
            if (gapY + 1 < GRID_SIZE && centerX >= 0 && centerX < GRID_SIZE) {
                grid[gapY + 1][centerX].whiteRect = true;
            }
            
            // 첫 번째 빨간 점
            if (gapY + 2 < GRID_SIZE && centerX - 1 >= 0 && centerX - 1 < GRID_SIZE) {
                grid[gapY + 2][centerX - 1].dot = true;
            }
            
            // 대각선 대시 (오른쪽 위 → 왼쪽 아래)
            if (gapY + 3 < GRID_SIZE && centerX - 2 >= 0 && centerX - 2 < GRID_SIZE) {
                grid[gapY + 3][centerX - 2].vertical = true;
            }
            
            // 두 번째 빨간 점
            if (gapY + 4 < GRID_SIZE && centerX - 3 >= 0 && centerX - 3 < GRID_SIZE) {
                grid[gapY + 4][centerX - 3].dot = true;
            }
        }
    }
    
    // 교차점: 가로/세로 간격이 만나는 곳에 4개의 빨간 점 (2x2 배열)
    for (let bx = 0; bx < 2; bx++) {
        for (let by = 0; by < 2; by++) {
            const gapX = (bx + 1) * BLOCK_SIZE - 1;
            const gapY = (by + 1) * BLOCK_SIZE - 1;
            const centerX = gapX + 2; // 가로 간격의 중앙
            const centerY = gapY + 2; // 세로 간격의 중앙
            
            // 2x2 빨간 점 배열
            for (let dx = 0; dx < 2; dx++) {
                for (let dy = 0; dy < 2; dy++) {
                    const x = centerX + dx;
                    const y = centerY + dy;
                    if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
                        grid[y][x].dot = true;
                    }
                }
            }
        }
    }
    
    patternsInitialized = true;
}

// 음악에 따라 애니메이션 타이밍 조절 (패턴 자동 생성 없음, 타이밍만 조절)
function updatePatternFromMusic() {
    if (!musicMode) return;
    
    // 패턴 자동 생성 제거 - 사용자가 그린 패턴 유지
    
    // 각 레이어별 에너지 계산 (애니메이션 타이밍 조절용)
    const whiteRectEnergy = getLayerEnergy('whiteRect');
    const greenRectEnergy = getLayerEnergy('greenRect');
    const horizontalEnergy = getLayerEnergy('horizontal');
    const verticalEnergy = getLayerEnergy('vertical');
    const dotEnergy = getLayerEnergy('dot');
    
    // 각 레이어별 에너지를 애니메이션 속도 조절에 사용 (패턴은 유지, 타이밍만 변경)
    // 에너지가 높을수록 애니메이션이 빠르게
    layerAnimationSpeed.whiteRect = Math.max(0.5, Math.min(2.0, whiteRectEnergy.mid / 30));
    layerAnimationSpeed.greenRect = Math.max(0.5, Math.min(2.0, greenRectEnergy.low / 30));
    layerAnimationSpeed.horizontal = Math.max(0.5, Math.min(2.0, horizontalEnergy.mid / 30));
    layerAnimationSpeed.vertical = Math.max(0.5, Math.min(2.0, verticalEnergy.mid / 30));
    layerAnimationSpeed.dot = Math.max(0.5, Math.min(2.0, dotEnergy.high / 30));
    
    // 전역 애니메이션 속도도 조절
    const avgEnergy = (whiteRectEnergy.mid + greenRectEnergy.low + 
                      horizontalEnergy.mid + verticalEnergy.mid + dotEnergy.high) / 5;
    animationSpeedMultiplier = Math.max(0.5, Math.min(2.0, avgEnergy / 30));
}

// 애니메이션 시작
animate();

// 도구 선택 UI 추가
const toolSelector = document.createElement('div');
toolSelector.className = 'tool-selector';
toolSelector.innerHTML = `
    <h2>패턴 선택</h2>
    <div class="tools">
        <div class="tool-group">
            <div class="tool-group-label">1. Left to Right □</div>
            <div class="tool-group-buttons">
                <button class="tool-btn active" data-tool="whiteRect4">4x</button>
                <button class="tool-btn" data-tool="whiteRect2">2x</button>
                <button class="tool-btn" data-tool="whiteRect1">1x</button>
            </div>
        </div>
        <div class="tool-group">
            <div class="tool-group-label">2. Right to Left □</div>
            <div class="tool-group-buttons">
                <button class="tool-btn" data-tool="greenRect4">4x</button>
                <button class="tool-btn" data-tool="greenRect2">2x</button>
                <button class="tool-btn" data-tool="greenRect1">1x</button>
            </div>
        </div>
        <div class="tool-group">
            <div class="tool-group-label">3. Backslash (\\)</div>
            <div class="tool-group-buttons">
                <button class="tool-btn" data-tool="horizontal1x">0.5x</button>
                <button class="tool-btn" data-tool="horizontal1xFull">1x</button>
                <button class="tool-btn" data-tool="horizontalFixed">fixed</button>
            </div>
        </div>
        <div class="tool-group">
            <div class="tool-group-label">4. Slash (/)</div>
            <div class="tool-group-buttons">
                <button class="tool-btn" data-tool="vertical1x">0.5x</button>
                <button class="tool-btn" data-tool="vertical1xFull">1x</button>
                <button class="tool-btn" data-tool="verticalFixed">fixed</button>
            </div>
        </div>
        <div class="tool-group">
            <div class="tool-group-label">5. Dot (.)</div>
            <div class="tool-group-buttons">
                <button class="tool-btn" data-tool="dot1x">1x</button>
                <button class="tool-btn" data-tool="dot4x">4x</button>
                <button class="tool-btn" data-tool="dot8x">8x</button>
            </div>
        </div>
    </div>
    <p class="tool-hint">키보드로도 선택 가능</p>
`;

document.querySelector('.controls-right').appendChild(toolSelector);

// 배경 컬러 피커 추가 (controls-right 맨 아래)
const backgroundColorControl = document.createElement('div');
backgroundColorControl.style.marginTop = '30px';
backgroundColorControl.style.paddingTop = '20px';
backgroundColorControl.style.borderTop = '1px solid #3a3a3a';
backgroundColorControl.innerHTML = `
    <label style="display: flex; align-items: center; gap: 10px; color: #cccccc; font-size: 14px;">
        <span>Background Color:</span>
        <input type="color" id="background-color" value="#000000" class="color-picker">
    </label>
`;
document.querySelector('.controls-right').appendChild(backgroundColorControl);

// 배경 컬러 변경 이벤트
document.getElementById('background-color').addEventListener('input', (e) => {
    backgroundColor = e.target.value;
    draw();
});

// 그리드 타입 선택 버튼 이벤트
document.querySelectorAll('.grid-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        
        // 모든 버튼 비활성화
        document.querySelectorAll('.grid-type-btn').forEach(b => {
            b.classList.remove('active');
        });
        
        // 클릭한 버튼 활성화
        btn.classList.add('active');
        
        // 그리드 타입 변경
        gridType = type;
        
        draw();
    });
});

// 도구 버튼 이벤트
document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTool = btn.dataset.tool;
    });
});

// 확장 그리드 크기 버튼 이벤트
document.querySelectorAll('.grid-size-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const layer = btn.dataset.layer;
        const size = parseInt(btn.dataset.size);
        
        // 같은 레이어의 다른 버튼들 비활성화
        document.querySelectorAll(`.grid-size-btn[data-layer="${layer}"]`).forEach(b => {
            b.classList.remove('active');
        });
        
        // 클릭한 버튼 활성화
        btn.classList.add('active');
        
        // 레이어별 최대 그리드 설정
        if (layer === 'whiteRect') {
            layerMaxGrid.whiteRect = size;
        } else if (layer === 'greenRect') {
            layerMaxGrid.greenRect = size;
        }
        
        draw();
    });
});

// 페이지 로드 시 자동으로 패턴 불러오기
window.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('pattern_christmas.json');
        if (response.ok) {
            const patternData = await response.json();
            loadPatternData(patternData, false); // 자동 로드는 알림 없이
        } else {
            console.log('패턴 파일을 찾을 수 없습니다. 기본 상태로 시작합니다.');
        }
    } catch (error) {
        console.log('패턴 파일 로드 실패:', error);
        // 에러가 발생해도 기본 상태로 시작
    }
});

