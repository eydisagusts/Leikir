namespace Leikir.Models.DTO.Score;

public class ScoreDTO
{
    public int Id { get; set; }
    
    public int UserId { get; set; }

    public int GameId { get; set; }
    
    public int UserScore { get; set; }
    
    public int? NumberOfAttempts { get; set; }
    public int? TimeInSeconds { get; set; }
    public string? GuessedWord { get; set; }

    public DateTime AchivedAt { get; set; } = DateTime.UtcNow;
}