using Leikir.Models.DTO.Score;

namespace Leikir.Models.DTO.User;

public class UserDetailsDTO
{
    public int UserId { get; set; }
    
    public string Name { get; set; } = null!;
    
    public string Username { get; set; } = null!;
    
    public string Email { get; set; } = null!;
    
    public int TotalScore { get; set; }
}