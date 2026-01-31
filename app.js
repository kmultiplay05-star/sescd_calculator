/**
 * SES-CD / MM-SES-CD Calculator App
 * 音声入力対応のスコア計算アプリ
 * 一覧形式 + ボタン選択UI
 */

// ===================================
// State Management
// ===================================
const state = {
    segments: ['ileum', 'right-colon', 'transverse', 'left-colon', 'rectum'],
    variables: ['ulcer-size', 'ulcer-surface', 'affected-surface', 'stenosis'],
    segmentNames: {
        'ileum': '回腸',
        'right-colon': '右結腸',
        'transverse': '横行結腸',
        'left-colon': '左結腸',
        'rectum': '直腸'
    },
    variableNames: {
        'ulcer-size': '潰瘍サイズ',
        'ulcer-surface': '潰瘍面積',
        'affected-surface': '病変面積',
        'stenosis': '狭窄'
    },
    scores: {},
    currentVoiceTarget: null,
    currentVariableIndex: 0,
    recognition: null
};

// Initialize scores
state.segments.forEach(segment => {
    state.scores[segment] = {};
    state.variables.forEach(variable => {
        state.scores[segment][variable] = null;
    });
});

// ===================================
// MM-SES-CD Multiplier Table
// ===================================
const MM_MULTIPLIER = {
    'ileum': { A: 1, B: 3, C: 5, D: 4, E: 4 },
    'right-colon': { A: 3, B: 2, C: 1, D: 1, E: 4 },
    'transverse': { A: 1, B: 1, C: 1, D: 1, E: 4 },
    'left-colon': { A: 3, B: 2, C: 1, D: 2, E: 4 },
    'rectum': { A: 3, B: 1, C: 0.5, D: 2, E: 4 }
};

// ===================================
// Scoring Criteria Data
// ===================================
const SCORING_CRITERIA = {
    'ulcer-size': [
        '潰瘍なし',
        'アフタ性潰瘍（0.1〜0.5cm）',
        '大きな潰瘍（0.5〜2cm）',
        '非常に大きな潰瘍（＞2cm）'
    ],
    'ulcer-surface': [
        'なし',
        '＜10%',
        '10〜30%',
        '＞30%'
    ],
    'affected-surface': [
        '病変なし',
        '＜50%',
        '50〜75%',
        '＞75%'
    ],
    'stenosis': [
        'なし',
        '単発、通過可能',
        '多発、通過可能',
        '通過不能'
    ]
};

// ===================================
// DOM Elements
// ===================================
const elements = {
    voiceStatus: document.getElementById('voiceStatus'),
    resetBtn: document.getElementById('resetBtn'),
    voiceModal: document.getElementById('voiceModal'),
    voiceResult: document.getElementById('voiceResult'),
    voiceSegment: document.getElementById('voiceSegment'),
    sescdScore: document.getElementById('sescdScore'),
    mmsescdScore: document.getElementById('mmsescdScore'),
    sescdSeverity: document.getElementById('sescdSeverity'),
    sescdBar: document.getElementById('sescdBar'),
    segmentCount: document.getElementById('segmentCount'),
    mmsescdRemission: document.getElementById('mmsescdRemission'),
    mmsescdStatus: document.getElementById('mmsescdStatus'),
    criteriaPanel: document.getElementById('criteriaPanel'),
    criteriaToggle: document.getElementById('criteriaToggle')
};

// ===================================
// Voice Recognition Setup
// ===================================
function initVoiceRecognition() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        updateVoiceStatus('error', '音声認識非対応');
        console.warn('Speech Recognition is not supported in this browser.');
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    state.recognition = new SpeechRecognition();
    state.recognition.lang = 'ja-JP';
    state.recognition.continuous = false;
    state.recognition.interimResults = true;

    state.recognition.onstart = () => {
        updateVoiceStatus('listening', '音声認識中...');
        showVoiceModal();
    };

    state.recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        elements.voiceResult.textContent = transcript;

        if (event.results[0].isFinal) {
            processVoiceInput(transcript);
        }
    };

    state.recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        updateVoiceStatus('error', 'エラー発生');
        hideVoiceModal();

        setTimeout(() => {
            updateVoiceStatus('ready', '音声入力準備完了');
        }, 2000);
    };

    state.recognition.onend = () => {
        // Check if we should continue to next variable
        if (state.currentVoiceTarget && state.currentVariableIndex < state.variables.length) {
            // Continue voice input for next variable
            setTimeout(() => {
                continueVoiceInput();
            }, 500);
        } else {
            hideVoiceModal();
            updateVoiceStatus('ready', '音声入力準備完了');

            document.querySelectorAll('.voice-btn-mini.listening').forEach(btn => {
                btn.classList.remove('listening');
            });
        }
    };

    updateVoiceStatus('ready', '音声入力準備完了');
}

function updateVoiceStatus(status, text) {
    elements.voiceStatus.className = 'voice-status ' + status;
    elements.voiceStatus.querySelector('.status-text').textContent = text;
}

function showVoiceModal() {
    elements.voiceModal.classList.add('active');
    elements.voiceResult.textContent = '';
    updateVoiceSegmentDisplay();
}

function hideVoiceModal() {
    elements.voiceModal.classList.remove('active');
    state.currentVoiceTarget = null;
    state.currentVariableIndex = 0;
}

function updateVoiceSegmentDisplay() {
    if (state.currentVoiceTarget && state.currentVariableIndex < state.variables.length) {
        const segmentName = state.segmentNames[state.currentVoiceTarget];
        const variable = state.variables[state.currentVariableIndex];
        const variableName = state.variableNames[variable];
        elements.voiceSegment.textContent = `${segmentName} - ${variableName}`;

        // Update criteria display
        const criteria = SCORING_CRITERIA[variable];
        if (criteria) {
            for (let i = 0; i <= 3; i++) {
                const descEl = document.getElementById(`criteriaDesc${i}`);
                if (descEl) {
                    descEl.textContent = criteria[i] || '-';
                }
            }
        }
    }
}

function startVoiceRecognition(segment) {
    if (!state.recognition) {
        alert('このブラウザは音声認識に対応していません。\nChrome、Safari、またはEdgeをお使いください。');
        return;
    }

    state.currentVoiceTarget = segment;
    state.currentVariableIndex = 0;

    // Add listening class to the button
    const btn = document.querySelector(`.voice-btn-mini[data-segment="${segment}"]`);
    if (btn) btn.classList.add('listening');

    try {
        state.recognition.start();
    } catch (error) {
        console.error('Failed to start recognition:', error);
    }
}

function continueVoiceInput() {
    updateVoiceSegmentDisplay();
    elements.voiceResult.textContent = '';

    try {
        state.recognition.start();
    } catch (error) {
        console.error('Failed to continue recognition:', error);
        hideVoiceModal();
    }
}

function processVoiceInput(transcript) {
    if (!state.currentVoiceTarget) return;

    const segment = state.currentVoiceTarget;
    const variable = state.variables[state.currentVariableIndex];

    // Parse the transcript for numbers
    const numberMap = {
        'ゼロ': 0, '零': 0, 'れい': 0, '0': 0,
        'いち': 1, '一': 1, 'イチ': 1, '1': 1,
        'に': 2, '二': 2, 'ニ': 2, '2': 2,
        'さん': 3, '三': 3, 'サン': 3, '3': 3
    };

    let score = null;

    // First try exact match
    const cleanTranscript = transcript.trim();
    if (numberMap.hasOwnProperty(cleanTranscript)) {
        score = numberMap[cleanTranscript];
    } else {
        // Try to find a number in the transcript
        for (const [key, value] of Object.entries(numberMap)) {
            if (cleanTranscript.includes(key)) {
                score = value;
                break;
            }
        }
    }

    // Also check for digit characters
    const digitMatch = cleanTranscript.match(/[0-3]/);
    if (score === null && digitMatch) {
        score = parseInt(digitMatch[0], 10);
    }

    if (score !== null && score >= 0 && score <= 3) {
        setScore(segment, variable, score);
        elements.voiceResult.textContent = `${score} 点を入力しました`;

        // Move to next variable
        state.currentVariableIndex++;

        if (state.currentVariableIndex >= state.variables.length) {
            // All variables done for this segment
            setTimeout(() => {
                hideVoiceModal();
                updateVoiceStatus('ready', '音声入力準備完了');
                document.querySelectorAll('.voice-btn-mini.listening').forEach(btn => {
                    btn.classList.remove('listening');
                });
            }, 800);
        }
    } else {
        elements.voiceResult.textContent = '認識できませんでした。もう一度お試しください。';
    }
}

// ===================================
// Score Management
// ===================================
function setScore(segment, variable, value) {
    state.scores[segment][variable] = value;

    // Update button states
    const buttonGroup = document.querySelector(`.score-buttons[data-segment="${segment}"][data-variable="${variable}"]`);
    if (buttonGroup) {
        buttonGroup.querySelectorAll('.score-btn').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.value) === value);
        });
    }

    // Recalculate totals
    calculateScores();
}

function clearScore(segment, variable) {
    state.scores[segment][variable] = null;

    // Remove active class from all buttons in the group
    const buttonGroup = document.querySelector(`.score-buttons[data-segment="${segment}"][data-variable="${variable}"]`);
    if (buttonGroup) {
        buttonGroup.querySelectorAll('.score-btn').forEach(btn => {
            btn.classList.remove('active');
        });
    }

    calculateScores();
}

function resetAllScores() {
    // Reset all scores in state
    state.segments.forEach(segment => {
        state.variables.forEach(variable => {
            state.scores[segment][variable] = null;
        });
    });

    // Remove active class from all buttons
    document.querySelectorAll('.score-btn.active').forEach(btn => {
        btn.classList.remove('active');
    });

    // Recalculate to update display
    calculateScores();
}

// ===================================
// Score Calculations
// ===================================
function calculateScores() {
    let sescdTotal = 0;
    let mmsescdTotal = 0;
    const mmBySegment = {};

    state.segments.forEach(segment => {
        // Get individual scores (default to 0 if null for calculation)
        const ulcerSize = state.scores[segment]['ulcer-size'] ?? 0;
        const ulcerSurface = state.scores[segment]['ulcer-surface'] ?? 0;
        const affectedSurface = state.scores[segment]['affected-surface'] ?? 0;
        const stenosis = state.scores[segment]['stenosis'] ?? 0;

        // SES-CD: Simple sum of all scores
        const segmentSescd = ulcerSize + ulcerSurface + affectedSurface + stenosis;

        // Update segment subtotal (SES-CD)
        const subtotalEl = document.getElementById(`subtotal-${segment}`);
        if (subtotalEl) {
            subtotalEl.textContent = segmentSescd;
        }

        sescdTotal += segmentSescd;

        // MM-SES-CD: Weighted calculation with multipliers
        const m = MM_MULTIPLIER[segment];

        // Ulcerated Flag (E): 1 if ulcerSize > 0, otherwise 0
        const ulceratedFlag = ulcerSize > 0 ? 1 : 0;

        // Calculate MM-SES-CD for this segment
        const segmentMmSescd =
            ulcerSize * m.A +
            ulcerSurface * m.B +
            affectedSurface * m.C +
            stenosis * m.D +
            ulceratedFlag * m.E;

        mmBySegment[segment] = segmentMmSescd;
        mmsescdTotal += segmentMmSescd;
    });

    // Update SES-CD display
    elements.sescdScore.textContent = sescdTotal;
    updateSeverity(sescdTotal);

    // Update MM-SES-CD display
    elements.mmsescdScore.textContent = mmsescdTotal.toFixed(1);

    // Update MM-SES-CD Endoscopic Remission status
    const isRemission = mmsescdTotal < 22.5;
    if (elements.mmsescdRemission) {
        elements.mmsescdRemission.className = 'severity-indicator ' + (isRemission ? 'mm-remission' : 'mm-active');
    }
    if (elements.mmsescdStatus) {
        elements.mmsescdStatus.textContent = isRemission ? 'Endoscopic Remission' : 'Active Disease';
    }

    // Update segment count display
    const affectedCount = Object.values(mmBySegment).filter(v => v > 0).length;
    elements.segmentCount.textContent = affectedCount;
}

function updateSeverity(score) {
    let severity, severityText, barWidth;

    if (score <= 2) {
        severity = 'remission';
        severityText = '寛解';
        barWidth = Math.max(3, (score / 60) * 100);
    } else if (score <= 6) {
        severity = 'mild';
        severityText = '軽症';
        barWidth = (score / 60) * 100;
    } else if (score <= 15) {
        severity = 'moderate';
        severityText = '中等症';
        barWidth = (score / 60) * 100;
    } else {
        severity = 'severe';
        severityText = '重症';
        barWidth = (score / 60) * 100;
    }

    // Update severity indicator
    elements.sescdSeverity.className = 'severity-indicator ' + severity;
    elements.sescdSeverity.querySelector('.severity-value').textContent = severityText;

    // Update severity bar
    elements.sescdBar.className = 'severity-fill ' + severity;
    elements.sescdBar.style.width = barWidth + '%';
}

// ===================================
// Event Listeners
// ===================================
function initEventListeners() {
    // Score button clicks
    document.querySelectorAll('.score-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const buttonGroup = btn.closest('.score-buttons');
            const segment = buttonGroup.dataset.segment;
            const variable = buttonGroup.dataset.variable;
            const value = parseInt(btn.dataset.value);

            // Toggle: if already active, clear the score
            if (btn.classList.contains('active')) {
                clearScore(segment, variable);
            } else {
                setScore(segment, variable, value);
            }
        });
    });

    // Voice buttons
    document.querySelectorAll('.voice-btn-mini').forEach(btn => {
        btn.addEventListener('click', () => {
            const segment = btn.dataset.segment;
            startVoiceRecognition(segment);
        });
    });

    // Reset button
    elements.resetBtn.addEventListener('click', resetAllScores);

    // Close modal on click outside
    elements.voiceModal.addEventListener('click', (e) => {
        if (e.target === elements.voiceModal) {
            if (state.recognition) {
                state.recognition.abort();
            }
            hideVoiceModal();
            updateVoiceStatus('ready', '音声入力準備完了');
            document.querySelectorAll('.voice-btn-mini.listening').forEach(btn => {
                btn.classList.remove('listening');
            });
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Escape to close modal
        if (e.key === 'Escape' && elements.voiceModal.classList.contains('active')) {
            if (state.recognition) {
                state.recognition.abort();
            }
            hideVoiceModal();
            updateVoiceStatus('ready', '音声入力準備完了');
            document.querySelectorAll('.voice-btn-mini.listening').forEach(btn => {
                btn.classList.remove('listening');
            });
        }
    });

    // Criteria panel toggle
    if (elements.criteriaToggle) {
        elements.criteriaToggle.addEventListener('click', () => {
            elements.criteriaPanel.classList.toggle('expanded');
        });
    }
}

// ===================================
// Initialization
// ===================================
function init() {
    initVoiceRecognition();
    initEventListeners();
    calculateScores();

    console.log('SES-CD / MM-SES-CD Calculator initialized (List View)');
}

// Start the app when DOM is ready
document.addEventListener('DOMContentLoaded', init);
