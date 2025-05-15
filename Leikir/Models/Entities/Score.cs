using System.ComponentModel.DataAnnotations;

namespace Leikir.Models;

public class Score
{
    public int Id { get; set; }
    
    [Required]
    public int UserId { get; set; }
    [Required]
    public User User { get; set; }
    
    [Required]
    public int GameId { get; set; }
    [Required]
    public Game Game { get; set; }
    
    [Required]
    public int UserScore { get; set; }
    
    public int? NumberOfAttempts { get; set; }
    public int? TimeInSeconds { get; set; }
    public string? GuessedWord { get; set; }

    public DateTime AchivedAt { get; set; } = DateTime.UtcNow;
}