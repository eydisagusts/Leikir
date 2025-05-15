namespace Leikir.Models.DTO.Game;

public class GameReadDTO
{
    public int Id { get; set; }
    
    public string Name { get; set; } = null!;
    
    public string Description { get; set; } = null!;
}