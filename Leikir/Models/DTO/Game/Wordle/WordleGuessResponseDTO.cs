namespace Leikir.Models.DTO.Game.Wordle;

public class WordleGuessResponseDto
{
    public string Guess { get; set; } = null!;
    public List<LetterState> LetterStates { get; set; } = new();
    public bool IsCorrect { get; set; }
    public bool IsGameOver { get; set; }
    public bool IsWon { get; set; }
    public int Score { get; set; }
}

public enum LetterState
{
    Correct,    // Letter is in the correct position
    Present,    // Letter is in the word but wrong position
    Absent      // Letter is not in the word
} 