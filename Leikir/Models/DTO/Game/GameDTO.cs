namespace Leikir.Models.DTO.Game;

public class GameDTO
{
    public int Id { get; set; }
    
    public string Name { get; set; }

    public string Description { get; set; }
    
    public ICollection<Models.Score> Scores { get; set; }
}