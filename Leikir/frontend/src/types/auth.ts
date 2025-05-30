export interface User {
    id: number;
    name: string;
    username: string;
    email: string;
    totalScore: number;
}

export interface RegisterData {
    name: string;
    username: string;
    email: string;
    password: string;
    confirmPassword: string;
}

export interface LoginData {
    email: string;
    password: string;
}