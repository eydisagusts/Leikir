namespace Leikir.Models.DTO.Game.Wordle;

public class WordleGameStateDto
{
    public int UserId { get; set; }
    public int GameId { get; set; }
    public string TargetWord { get; set; } = null!;
    public List<string> Guesses { get; set; } = new();
    public int NumberOfAttempts { get; set; }
    public bool IsGameOver { get; set; }
    public bool IsWon { get; set; }
    public int Score { get; set; }
    public DateTime StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
}