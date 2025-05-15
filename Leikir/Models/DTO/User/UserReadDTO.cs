namespace Leikir.Models.DTO.User;

public class UserReadDTO
{
    public int Id { get; set; }
    
    public string Name { get; set; } = null!;
    
    public string Username { get; set; } = null!;
    
    public string Email { get; set; } = null!;
    
    public ICollection<Models.Score> Scores { get; set; } = null!;
}