using Leikir.Data.Games.Wordle;
using Leikir.Data.Interfaces;
using Leikir.Models.DTO.Game.Wordle;
using Microsoft.AspNetCore.Mvc;

namespace Leikir.Controllers;

[Route("api/wordle")]
[ApiController]
public class WordleController : ControllerBase
{
    private readonly WordleGameService _gameService;

    public WordleController(WordleGameService gameService)
    {
        _gameService = gameService;
    }

    [HttpPost("start")]
    public async Task<ActionResult<WordleGameStateDto>> StartNewGame([FromQuery] int userId)
    {
        try
        {
            var gameState = await _gameService.StartNewGameAsync(userId, 1); // 1 is the Wordle game ID
            return Ok(gameState);
        }
        catch (Exception ex)
        {
            return StatusCode(500, ex.Message);
        }
    }

    [HttpGet("state")]
    public async Task<ActionResult<WordleGameStateDto>> GetGameState([FromQuery] int userId)
    {
        try
        {
            var gameState = await _gameService.GetCurrentGameStateAsync(userId, 1);
            if (gameState == null)
            {
                return NotFound("No active game found");
            }
            return Ok(gameState);
        }
        catch (Exception ex)
        {
            return StatusCode(500, ex.Message);
        }
    }

    [HttpPost("guess")]
    public async Task<ActionResult<WordleGuessResponseDto>> MakeGuess(
        [FromQuery] int userId,
        [FromBody] string guess)
    {
        try
        {
            if (string.IsNullOrEmpty(guess) || guess.Length != 5)
            {
                return BadRequest("Guess must be a 5-letter word");
            }

            var response = await _gameService.MakeAttemptAsync(userId, 1, guess);
            return Ok(response);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(ex.Message);
        }
        catch (Exception ex)
        {
            return StatusCode(500, ex.Message);
        }
    }
} 