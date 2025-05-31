export interface WordleGameState {
    gameId: string;
    isGameOver: boolean;
    isWon: boolean;
    score: number;
    targetWord: string;
}

export interface WordleGuessResponse {
    guess: string;
    letterStates: LetterState[];
    isCorrect: boolean;
    isGameOver: boolean;
    isWon: boolean;
    score: number;
    targetWord: string;
}

export enum LetterState {
    Correct = 0,
    Present = 1,
    Absent = 2
}

export interface Row {
    letters: string[];
    states: (LetterState | null)[];
}

export interface GameGridProps {
    rows: Row[];
    currentRowIndex: number;
    currentColIndex: number;
    maxAttempts: number;
    wordLength: number;
    isGameOver: boolean;
    isWon: boolean;
    revealedRows: number[];
}

export interface KeyboardProps {
    onKeyPress: (key: string) => void;
    letterStates: Record<string, LetterState>;
    disabled?: boolean;
}