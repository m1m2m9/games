// =====================
// BLOCK BLAST GAME
// =====================

class SoundManager {
    constructor() {
        this.enabled = true;
        this.audioContext = null;
        this.init();
    }

    init() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.log('Web Audio API not supported');
        }
    }

    unlock() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }

    play(type) {
        if (!this.enabled || !this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        const now = this.audioContext.currentTime;

        switch (type) {
            case 'place':
                oscillator.frequency.setValueAtTime(400, now);
                oscillator.frequency.exponentialRampToValueAtTime(600, now + 0.1);
                gainNode.gain.setValueAtTime(0.2, now);
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
                oscillator.start(now);
                oscillator.stop(now + 0.15);
                break;

            case 'clear':
                oscillator.frequency.setValueAtTime(523, now);
                oscillator.frequency.exponentialRampToValueAtTime(1046, now + 0.2);
                gainNode.gain.setValueAtTime(0.25, now);
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
                oscillator.start(now);
                oscillator.stop(now + 0.3);
                break;

            case 'combo':
                const freqs = [523, 659, 784, 1046];
                freqs.forEach((freq, i) => {
                    const osc = this.audioContext.createOscillator();
                    const gain = this.audioContext.createGain();
                    osc.connect(gain);
                    gain.connect(this.audioContext.destination);
                    osc.frequency.setValueAtTime(freq, now + i * 0.1);
                    gain.gain.setValueAtTime(0.15, now + i * 0.1);
                    gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.2);
                    osc.start(now + i * 0.1);
                    osc.stop(now + i * 0.1 + 0.2);
                });
                break;

            case 'gameover':
                oscillator.frequency.setValueAtTime(400, now);
                oscillator.frequency.exponentialRampToValueAtTime(100, now + 0.5);
                gainNode.gain.setValueAtTime(0.3, now);
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
                oscillator.start(now);
                oscillator.stop(now + 0.5);
                break;

            case 'click':
                oscillator.frequency.setValueAtTime(800, now);
                gainNode.gain.setValueAtTime(0.1, now);
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
                oscillator.start(now);
                oscillator.stop(now + 0.05);
                break;
        }
    }

    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }
}

class BlockBlastGame {
    constructor() {
        this.boardSize = 8;
        this.board = [];
        this.score = 0;
        this.highScore = parseInt(localStorage.getItem('blockBlastHighScore')) || 0;
        this.currentPieces = [];
        this.selectedPiece = null;
        this.selectedPieceIndex = -1;
        this.isDragging = false;
        this.vibrationEnabled = true;

        this.sound = new SoundManager();

        this.shapes = [
            // Одиночные и маленькие
            [[1]],
            [[1, 1]],
            [[1], [1]],
            [[1, 1], [1, 1]],
            [[1, 1, 1]],
            [[1], [1], [1]],

            // L-образные
            [[1, 0], [1, 0], [1, 1]],
            [[0, 1], [0, 1], [1, 1]],
            [[1, 1], [1, 0], [1, 0]],
            [[1, 1], [0, 1], [0, 1]],
            [[1, 0, 0], [1, 1, 1]],
            [[0, 0, 1], [1, 1, 1]],
            [[1, 1, 1], [1, 0, 0]],
            [[1, 1, 1], [0, 0, 1]],

            // T-образные
            [[1, 1, 1], [0, 1, 0]],
            [[0, 1, 0], [1, 1, 1]],
            [[1, 0], [1, 1], [1, 0]],
            [[0, 1], [1, 1], [0, 1]],

            // Длинные
            [[1, 1, 1, 1]],
            [[1], [1], [1], [1]],
            [[1, 1, 1, 1, 1]],
            [[1], [1], [1], [1], [1]],

            // Большие квадраты
            [[1, 1, 1], [1, 1, 1], [1, 1, 1]],

            // Z-образные
            [[1, 1, 0], [0, 1, 1]],
            [[0, 1, 1], [1, 1, 0]],
            [[0, 1], [1, 1], [1, 0]],
            [[1, 0], [1, 1], [0, 1]],

            // Плюс
            [[0, 1, 0], [1, 1, 1], [0, 1, 0]]
        ];

        this.colors = ['color-1', 'color-2', 'color-3', 'color-4', 'color-5', 'color-6', 'color-7'];

        this.initElements();
        this.initEventListeners();
        this.createParticles();
        this.updateHighScoreDisplay();
    }

    initElements() {
        this.menuScreen = document.getElementById('menuScreen');
        this.gameScreen = document.getElementById('gameScreen');
        this.gameBoard = document.getElementById('gameBoard');
        this.piecesPanel = document.getElementById('piecesPanel');
        this.scoreDisplay = document.getElementById('currentScore');
        this.bestDisplay = document.getElementById('bestScore');
        this.highScoreDisplay = document.getElementById('highScoreValue');
        this.ghostPiece = document.getElementById('ghostPiece');

        // Модальные окна
        this.pauseModal = document.getElementById('pauseModal');
        this.gameOverModal = document.getElementById('gameOverModal');
        this.settingsModal = document.getElementById('settingsModal');
    }

    initEventListeners() {
        // Главное меню
        document.getElementById('btnPlay').addEventListener('click', () => this.startGame());
        document.getElementById('btnSettings').addEventListener('click', () => this.openSettings());

        // Игровой экран
        document.getElementById('btnPause').addEventListener('click', () => this.pauseGame());
        document.getElementById('btnSound').addEventListener('click', () => this.toggleSoundQuick());

        // Пауза
        document.getElementById('btnResume').addEventListener('click', () => this.resumeGame());
        document.getElementById('btnRestartPause').addEventListener('click', () => this.restartGame());
        document.getElementById('btnMenuPause').addEventListener('click', () => this.goToMenu());

        // Game Over
        document.getElementById('btnRestartOver').addEventListener('click', () => this.restartGame());
        document.getElementById('btnMenuOver').addEventListener('click', () => this.goToMenu());

        // Настройки
        document.getElementById('toggleSound').addEventListener('click', (e) => this.toggleSound(e.currentTarget));
        document.getElementById('toggleVibration').addEventListener('click', (e) => this.toggleVibration(e.currentTarget));
        document.getElementById('btnCloseSettings').addEventListener('click', () => this.closeSettings());

        // Глобальные touch/mouse события
        document.addEventListener('mousemove', (e) => this.handleDragMove(e));
        document.addEventListener('mouseup', (e) => this.handleDragEnd(e));
        document.addEventListener('touchmove', (e) => this.handleDragMove(e), { passive: false });
        document.addEventListener('touchend', (e) => this.handleDragEnd(e));
        document.addEventListener('touchcancel', (e) => this.handleDragEnd(e));

        // Unlock audio on first interaction
        document.addEventListener('click', () => this.sound.unlock(), { once: true });
        document.addEventListener('touchstart', () => this.sound.unlock(), { once: true });
    }

    createParticles() {
        const container = document.getElementById('particles');
        for (let i = 0; i < 30; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.left = Math.random() * 100 + '%';
            particle.style.animationDelay = Math.random() * 15 + 's';
            particle.style.animationDuration = (10 + Math.random() * 10) + 's';
            container.appendChild(particle);
        }
    }

    startGame() {
        this.sound.play('click');
        this.menuScreen.style.display = 'none';
        this.gameScreen.style.display = 'block';

        this.resetGame();
    }

    resetGame() {
        this.board = Array(this.boardSize).fill(null).map(() => Array(this.boardSize).fill(null));
        this.score = 0;
        this.updateScore();
        this.createBoard();
        this.generateNewPieces();
    }

    createBoard() {
        this.gameBoard.innerHTML = '';
        for (let y = 0; y < this.boardSize; y++) {
            for (let x = 0; x < this.boardSize; x++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.x = x;
                cell.dataset.y = y;
                this.gameBoard.appendChild(cell);
            }
        }
    }

    generateNewPieces() {
        this.currentPieces = [];
        this.piecesPanel.innerHTML = '';

        for (let i = 0; i < 3; i++) {
            const shapeIndex = Math.floor(Math.random() * this.shapes.length);
            const colorIndex = Math.floor(Math.random() * this.colors.length);

            const piece = {
                shape: this.shapes[shapeIndex],
                color: this.colors[colorIndex],
                used: false
            };

            this.currentPieces.push(piece);
            this.createPieceElement(piece, i);
        }

        this.checkGameOver();
    }

    createPieceElement(piece, index) {
        const container = document.createElement('div');
        container.className = 'piece-container';
        container.dataset.index = index;

        const pieceEl = document.createElement('div');
        pieceEl.className = 'piece';
        pieceEl.style.gridTemplateColumns = `repeat(${piece.shape[0].length}, 1fr)`;

        for (let y = 0; y < piece.shape.length; y++) {
            for (let x = 0; x < piece.shape[0].length; x++) {
                const cell = document.createElement('div');
                cell.className = 'piece-cell';
                if (piece.shape[y][x]) {
                    cell.classList.add(piece.color);
                } else {
                    cell.classList.add('empty');
                }
                pieceEl.appendChild(cell);
            }
        }

        container.appendChild(pieceEl);
        this.piecesPanel.appendChild(container);

        // События
        container.addEventListener('mousedown', (e) => this.handleDragStart(e, index));
        container.addEventListener('touchstart', (e) => this.handleDragStart(e, index), { passive: false });
    }

    handleDragStart(e, index) {
        if (this.currentPieces[index].used) return;

        e.preventDefault();
        this.sound.unlock();

        this.isDragging = true;
        this.selectedPieceIndex = index;
        this.selectedPiece = this.currentPieces[index];

        const container = this.piecesPanel.children[index];
        container.classList.add('dragging');

        // Создаем ghost piece
        this.createGhostPiece(this.selectedPiece);

        const pos = this.getEventPosition(e);
        this.updateGhostPosition(pos.x, pos.y);
    }

    handleDragMove(e) {
        if (!this.isDragging) return;

        e.preventDefault();

        const pos = this.getEventPosition(e);
        this.updateGhostPosition(pos.x, pos.y);

        // Показываем превью на доске
        this.updateBoardPreview(pos.x, pos.y);
    }

    handleDragEnd(e) {
        if (!this.isDragging) return;

        const pos = this.getEventPosition(e);
        const boardPos = this.getBoardPosition(pos.x, pos.y);

        if (boardPos && this.canPlacePiece(this.selectedPiece.shape, boardPos.x, boardPos.y)) {
            this.placePiece(this.selectedPiece, boardPos.x, boardPos.y);
            this.currentPieces[this.selectedPieceIndex].used = true;
            this.piecesPanel.children[this.selectedPieceIndex].classList.add('used');

            // Проверяем нужны ли новые фигуры
            if (this.currentPieces.every(p => p.used)) {
                setTimeout(() => this.generateNewPieces(), 300);
            } else {
                this.checkGameOver();
            }
        }

        // Очистка
        this.clearBoardPreview();
        this.ghostPiece.style.display = 'none';

        if (this.selectedPieceIndex >= 0 && this.piecesPanel.children[this.selectedPieceIndex]) {
            this.piecesPanel.children[this.selectedPieceIndex].classList.remove('dragging');
        }

        this.isDragging = false;
        this.selectedPiece = null;
        this.selectedPieceIndex = -1;
    }

    getEventPosition(e) {
        if (e.touches && e.touches.length > 0) {
            return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        } else if (e.changedTouches && e.changedTouches.length > 0) {
            return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
        }
        return { x: e.clientX, y: e.clientY };
    }

    createGhostPiece(piece) {
        this.ghostPiece.innerHTML = '';
        const pieceEl = document.createElement('div');
        pieceEl.className = 'piece';
        pieceEl.style.gridTemplateColumns = `repeat(${piece.shape[0].length}, 1fr)`;
        pieceEl.style.gap = '3px';

        for (let y = 0; y < piece.shape.length; y++) {
            for (let x = 0; x < piece.shape[0].length; x++) {
                const cell = document.createElement('div');
                cell.className = 'piece-cell';
                if (piece.shape[y][x]) {
                    cell.classList.add(piece.color);
                } else {
                    cell.classList.add('empty');
                }
                pieceEl.appendChild(cell);
            }
        }

        this.ghostPiece.appendChild(pieceEl);
        this.ghostPiece.style.display = 'block';
    }

    updateGhostPosition(x, y) {
        this.ghostPiece.style.left = x + 'px';
        this.ghostPiece.style.top = (y - 60) + 'px';
    }

    getBoardPosition(screenX, screenY) {
        const boardRect = this.gameBoard.getBoundingClientRect();
        const cellSize = boardRect.width / this.boardSize;

        // Смещение для центрирования фигуры
        const offsetY = -60;

        const x = Math.floor((screenX - boardRect.left) / cellSize);
        const y = Math.floor((screenY + offsetY - boardRect.top) / cellSize);

        // Центрируем относительно размера фигуры
        const shape = this.selectedPiece.shape;
        const centerX = x - Math.floor(shape[0].length / 2);
        const centerY = y - Math.floor(shape.length / 2);

        if (centerX >= 0 && centerY >= 0 && 
            centerX + shape[0].length <= this.boardSize && 
            centerY + shape.length <= this.boardSize) {
            return { x: centerX, y: centerY };
        }

        return null;
    }

    updateBoardPreview(screenX, screenY) {
        this.clearBoardPreview();

        const boardPos = this.getBoardPosition(screenX, screenY);
        if (!boardPos) return;

        const canPlace = this.canPlacePiece(this.selectedPiece.shape, boardPos.x, boardPos.y);

        for (let py = 0; py < this.selectedPiece.shape.length; py++) {
            for (let px = 0; px < this.selectedPiece.shape[0].length; px++) {
                if (this.selectedPiece.shape[py][px]) {
                    const cellX = boardPos.x + px;
                    const cellY = boardPos.y + py;
                    const cell = this.getCellElement(cellX, cellY);
                    if (cell) {
                        cell.classList.add(canPlace ? 'preview' : 'preview-invalid');
                    }
                }
            }
        }
    }

    clearBoardPreview() {
        const cells = this.gameBoard.querySelectorAll('.cell');
        cells.forEach(cell => {
            cell.classList.remove('preview', 'preview-invalid');
        });
    }

    getCellElement(x, y) {
        return this.gameBoard.querySelector(`[data-x="${x}"][data-y="${y}"]`);
    }

    canPlacePiece(shape, startX, startY) {
        for (let py = 0; py < shape.length; py++) {
            for (let px = 0; px < shape[0].length; px++) {
                if (shape[py][px]) {
                    const x = startX + px;
                    const y = startY + py;

                    if (x < 0 || x >= this.boardSize || y < 0 || y >= this.boardSize) {
                        return false;
                    }

                    if (this.board[y][x]) {
                        return false;
                    }
                }
            }
        }
        return true;
    }

    placePiece(piece, startX, startY) {
        // Размещаем блоки
        for (let py = 0; py < piece.shape.length; py++) {
            for (let px = 0; px < piece.shape[0].length; px++) {
                if (piece.shape[py][px]) {
                    const x = startX + px;
                    const y = startY + py;

                    this.board[y][x] = piece.color;

                    const cell = this.getCellElement(x, y);
                    cell.classList.add('filled', piece.color);
                }
            }
        }

        this.sound.play('place');
        this.vibrate(10);

        // Подсчет блоков
        let blockCount = 0;
        for (let py = 0; py < piece.shape.length; py++) {
            for (let px = 0; px < piece.shape[0].length; px++) {
                if (piece.shape[py][px]) blockCount++;
            }
        }
        this.score += blockCount;
        this.updateScore();

        // Проверяем линии
        setTimeout(() => this.checkLines(), 100);
    }

    checkLines() {
        const rowsToClear = [];
        const colsToClear = [];

        // Проверяем строки
        for (let y = 0; y < this.boardSize; y++) {
            if (this.board[y].every(cell => cell !== null)) {
                rowsToClear.push(y);
            }
        }

        // Проверяем столбцы
        for (let x = 0; x < this.boardSize; x++) {
            let full = true;
            for (let y = 0; y < this.boardSize; y++) {
                if (!this.board[y][x]) {
                    full = false;
                    break;
                }
            }
            if (full) colsToClear.push(x);
        }

        const totalLines = rowsToClear.length + colsToClear.length;

        if (totalLines > 0) {
            // Помечаем ячейки для очистки
            const cellsToClear = new Set();

            rowsToClear.forEach(y => {
                for (let x = 0; x < this.boardSize; x++) {
                    cellsToClear.add(`${x},${y}`);
                }
            });

            colsToClear.forEach(x => {
                for (let y = 0; y < this.boardSize; y++) {
                    cellsToClear.add(`${x},${y}`);
                }
            });

            // Анимация очистки
            cellsToClear.forEach(key => {
                const [x, y] = key.split(',').map(Number);
                const cell = this.getCellElement(x, y);
                cell.classList.add('clearing');
            });

            // Очистка после анимации
            setTimeout(() => {
                cellsToClear.forEach(key => {
                    const [x, y] = key.split(',').map(Number);
                    this.board[y][x] = null;
                    const cell = this.getCellElement(x, y);
                    cell.className = 'cell';
                });
            }, 400);

            // Подсчет очков
            const baseScore = cellsToClear.size * 10;
            const comboBonus = totalLines > 1 ? totalLines * 20 : 0;
            this.score += baseScore + comboBonus;
            this.updateScore();

            // Эффекты
            if (totalLines > 1) {
                this.sound.play('combo');
                this.showComboEffect(totalLines);
                this.vibrate(50);
            } else {
                this.sound.play('clear');
                this.vibrate(20);
            }
        }
    }

    showComboEffect(lines) {
        const popup = document.createElement('div');
        popup.className = 'combo-popup';
        popup.textContent = `COMBO x${lines}!`;
        popup.style.left = '50%';
        popup.style.top = '50%';
        document.body.appendChild(popup);

        setTimeout(() => popup.remove(), 1000);
    }

    updateScore() {
        this.scoreDisplay.textContent = this.score;

        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('blockBlastHighScore', this.highScore);
        }

        this.bestDisplay.textContent = this.highScore;
    }

    updateHighScoreDisplay() {
        this.highScoreDisplay.textContent = this.highScore;
    }

    checkGameOver() {
        const availablePieces = this.currentPieces.filter(p => !p.used);

        for (const piece of availablePieces) {
            if (this.canPlaceAnywhere(piece.shape)) {
                return; // Игра продолжается
            }
        }

        // Game Over
        setTimeout(() => this.showGameOver(), 500);
    }

    canPlaceAnywhere(shape) {
        for (let y = 0; y <= this.boardSize - shape.length; y++) {
            for (let x = 0; x <= this.boardSize - shape[0].length; x++) {
                if (this.canPlacePiece(shape, x, y)) {
                    return true;
                }
            }
        }
        return false;
    }

    showGameOver() {
        this.sound.play('gameover');
        this.vibrate(100);

        document.getElementById('finalScore').textContent = this.score;

        const newRecordEl = document.getElementById('newRecord');
        if (this.score >= this.highScore && this.score > 0) {
            newRecordEl.style.display = 'block';
        } else {
            newRecordEl.style.display = 'none';
        }

        this.gameOverModal.classList.add('active');
        this.updateHighScoreDisplay();
    }

    pauseGame() {
        this.sound.play('click');
        this.pauseModal.classList.add('active');
    }

    resumeGame() {
        this.sound.play('click');
        this.pauseModal.classList.remove('active');
    }

    restartGame() {
        this.sound.play('click');
        this.pauseModal.classList.remove('active');
        this.gameOverModal.classList.remove('active');
        this.resetGame();
    }

    goToMenu() {
        this.sound.play('click');
        this.pauseModal.classList.remove('active');
        this.gameOverModal.classList.remove('active');
        this.gameScreen.style.display = 'none';
        this.menuScreen.style.display = 'block';
        this.updateHighScoreDisplay();
    }

    openSettings() {
        this.sound.play('click');
        this.settingsModal.classList.add('active');

        // Обновляем состояние toggles
        document.getElementById('toggleSound').classList.toggle('active', this.sound.enabled);
        document.getElementById('toggleVibration').classList.toggle('active', this.vibrationEnabled);
    }

    closeSettings() {
        this.sound.play('click');
        this.settingsModal.classList.remove('active');
    }

    toggleSound(el) {
        const enabled = this.sound.toggle();
        el.classList.toggle('active', enabled);
        if (enabled) this.sound.play('click');
    }

    toggleSoundQuick() {
        const enabled = this.sound.toggle();
        const btn = document.getElementById('btnSound');
        btn.textContent = enabled ? '🔊' : '🔇';
        if (enabled) this.sound.play('click');
    }

    toggleVibration(el) {
        this.sound.play('click');
        this.vibrationEnabled = !this.vibrationEnabled;
        el.classList.toggle('active', this.vibrationEnabled);
        if (this.vibrationEnabled) this.vibrate(20);
    }

    vibrate(duration) {
        if (this.vibrationEnabled && navigator.vibrate) {
            navigator.vibrate(duration);
        }
    }
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    new BlockBlastGame();
});
