using System.ComponentModel.DataAnnotations;

namespace Leikir.Models;

public class Game
{
    public int Id { get; set; }
    
    [Required]
    [MaxLength(100)]
    public string Name { get; set; }
    
    [Required]
    [MaxLength(500)]
    public string Description { get; set; }
    
    public ICollection<Score> Scores { get; set; }
}