namespace Leikir.Models.DTO.Game.Hangman;

public class HangmanGameStateDto
{
    public int UserId { get; set; }
    public int GameId { get; set; }
    public string TargetWord { get; set; } = null!;
    public List<char> GuessedLetters { get; set; } = new();
    public List<char> WrongLetters { get; set; } = new();
    public int NumberOfAttempts { get; set; }
    public bool IsGameOver { get; set; }
    public bool IsWon { get; set; }
    public int Score { get; set; }
    public DateTime StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
}