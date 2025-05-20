using Leikir.Data.Games.Hangman;
using Leikir.Data.Interfaces;
using Leikir.Models.DTO.Game.Hangman;
using Microsoft.AspNetCore.Mvc;

namespace Leikir.Controllers;

[Route("api/hangman")]
[ApiController]
public class HangmanController : ControllerBase
{
    private readonly HangmanGameService _gameService;

    public HangmanController(HangmanGameService gameService)
    {
        _gameService = gameService;
    }

    [HttpPost("start")]
    public async Task<ActionResult<HangmanGameStateDto>> StartNewGame([FromQuery] int userId)
    {
        try
        {
            var gameState = await _gameService.StartNewGameAsync(userId, 2); // 2 is the Hangman game ID
            return Ok(gameState);
        }
        catch (Exception ex)
        {
            return StatusCode(500, ex.Message);
        }
    }

    [HttpGet("state")]
    public async Task<ActionResult<HangmanGameStateDto>> GetGameState([FromQuery] int userId)
    {
        try
        {
            var gameState = await _gameService.GetCurrentGameStateAsync(userId, 2);
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
    public async Task<ActionResult<HangmanGuessResponseDto>> MakeGuess(
        [FromQuery] int userId,
        [FromBody] string guess)
    {
        try
        {
            if (string.IsNullOrEmpty(guess) || guess.Length != 1)
            {
                return BadRequest("Guess must be a single letter");
            }

            var response = await _gameService.MakeAttemptAsync(userId, 2, guess);
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