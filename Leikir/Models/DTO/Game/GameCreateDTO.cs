namespace Leikir.Models.DTO.Game;

public class GameCreateDTO
{
    public int Id { get; set; }
    
    public string Name { get; set; } = null!;
    
    public string Description { get; set; } = null!;
    
    public ICollection<Models.Score> Scores { get; set; } = new List<Models.Score>();
}