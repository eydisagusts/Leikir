namespace Leikir.Models.DTO.Game.Hangman;

public class HangmanGuessResponseDto
{
    public char Guess { get; set; }
    public bool IsCorrect { get; set; }
    public List<int> Positions { get; set; } = new();  // Positions where the letter appears
    public int RemainingAttempts { get; set; }
    public bool IsGameOver { get; set; }
    public bool IsWon { get; set; }
    public int Score { get; set; }
    public string CurrentWordState { get; set; } = null!;  // e.g., "_A__A_" for "BANANA"
} 