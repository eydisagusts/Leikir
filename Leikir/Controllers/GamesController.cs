using Leikir.Data.Interfaces;
using Leikir.Models.DTO.Game;
using Microsoft.AspNetCore.Mvc;

namespace Leikir.Controllers;

[Route("api/games")]
[Controller]

public class GamesController : ControllerBase
{
    private readonly IRepository _repository;
    
    public GamesController(IRepository repository)
    {
        _repository = repository;
    }
    
    // Read
    [HttpGet]
    public async Task<ActionResult<List<GameReadDTO>>> GetAllGamesAsync()
    {
        try
        {
            List<GameReadDTO> games = await _repository.GetAllGamesAsync();
            return Ok(games);
        }
        catch (Exception)
        {
            return StatusCode(500);
        }
    }
    
    [HttpGet("{id}")]
    public async Task<ActionResult<GameReadDTO>> GetGameByIdAsync(int id)
    {
        try
        {
            GameReadDTO game = await _repository.GetGameByIdAsync(id);
            
            if (game == null)
            {
                return NotFound();
            }
            return Ok(game);
        }
        catch (Exception)
        {
            return StatusCode(500);
        }
    }
    
    
    // Create
    
    [HttpPost]  
    public async Task<IActionResult> CreateGame([FromBody] GameCreateDTO game)
    {
        try
        {
            if (ModelState.IsValid)
            {
                await _repository.CreateGameAsync(game);
                return Ok(game);
            }
            else
            {
                return BadRequest(ModelState);
            }
        }
        catch (Exception)
        {
            return StatusCode(500);
        }
    }
    
    //Update
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateGame(int id, [FromBody] GameDTO game)
    {
        try
        {
            GameDTO updateGame = await _repository.UpdateGameAsync(id, game);
            
            if (updateGame == null)
            {
               return NotFound();
            }
            else
            {
                return Ok(updateGame);
            }
        }
        catch (Exception)
        {
            return StatusCode(500);
        }
    }
    
    // Delete
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteGame(int id)
    {
        try
        {
            bool deleteSuccessfull = await _repository.DeleteGameAsync(id);
            
            if (!deleteSuccessfull)
            {
                return NotFound();
            }
            else
            {
                return NoContent();
            }
        }
        catch (Exception)
        {
            return StatusCode(500);
        }
    }
    
}