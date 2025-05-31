using System.ComponentModel.DataAnnotations;

namespace Leikir.Models;

public class User
{
    public int Id { get; set; }
    
    [Required]
    [MaxLength(256)]
    public string Name { get; set; }
    
    [Required]
    [MaxLength(256)]
    public string Username { get; set; }
    
    [Required]
    [EmailAddress]
    public string Email { get; set; }
    
    [Required]
    [MaxLength(256)]
    public string PasswordHash { get; set; }
    
    public int TotalScore { get; set; }
    public int TotalGames { get; set; }
    public int TotalWins { get; set; }
    public int TotalLosses { get; set; }
    
    public ICollection<Score> Scores { get; set; }
}