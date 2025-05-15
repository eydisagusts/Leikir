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
    public string Email { get; set; }
    
    [Required]
    [MaxLength(256)]
    [MinLength(6)]
    public string Password { get; set; }
    
    public ICollection<Score> Scores { get; set; }
}