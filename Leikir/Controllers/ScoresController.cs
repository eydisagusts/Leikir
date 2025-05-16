using Leikir.Data.Interfaces;
using Leikir.Models.DTO.Score;
using Microsoft.AspNetCore.Mvc;

namespace Leikir.Controllers;

[Route("api/scores")]
[Controller]

public class ScoresController : ControllerBase
{
    private readonly IRepository _repository;
    
    public ScoresController(IRepository repository)
    {
        _repository = repository;
    }
    
    // Read
    [HttpGet]
    public async Task<ActionResult<List<ScoreDTO>>> GetAllScoresAsync()
    {
        try
        {
            List<ScoreDTO> scores = await _repository.GetAllScoresAsync();
            return Ok(scores);
        }
        catch (Exception)
        {
            return StatusCode(500);
        }
    }
    
    [HttpGet("{id}")]
    public async Task<ActionResult<ScoreDTO>> GetAllScoresByUserIdAsync(int id)
    {
        try
        {
            ScoreDTO score = await _repository.GetAllScoresByUserIdAsync(id);
            
            if (score == null)
            {
                return NotFound();
            }
            return Ok(score);
        }
        catch (Exception)
        {
            return StatusCode(500);
        }
    }
    
    [HttpPost]
    public async Task<IActionResult> CreateScore([FromBody] ScoreDTO score)
    {
        try
        {
            if (ModelState.IsValid)
            {
                await _repository.CreateScoreAsync(score);
                return Ok(score);
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
    public async Task<IActionResult> UpdateScore(int id, [FromBody] ScoreDTO score)
    {
        try
        {
            ScoreDTO updatedScore = await _repository.UpdateScoreAsync(id, score);

            if (updatedScore == null)
            {
                return NotFound();
            }
            else
            {
                return Ok(updatedScore);
            }
        }
        catch (Exception)
        {
            return StatusCode(500);
        }
    }
    
    //Delete
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteScore(int id)
    {
        try
        {
            bool deleteSuccessfull = await _repository.DeleteScoreAsync(id);
            
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