using Leikir.Data.Interfaces;
using Leikir.Models;
using Leikir.Models.DTO;
using Leikir.Models.DTO.User;
using Microsoft.AspNetCore.Mvc;

namespace Leikir.Controllers;

[Route("api/users")]
[Controller]

public class UsersController : ControllerBase
{
    private readonly IRepository _repository;

    public UsersController(IRepository repository)
    {
        _repository = repository;
    }
    
    // Read
    [HttpGet]
    public async Task<ActionResult<List<UserReadDTO>>> GetAllUsers()
    {
        try
        {
            List<UserReadDTO> users = await _repository.GetAllUsersAsync();
            return Ok(users);
        }
        catch (Exception)
        {
            return StatusCode(500);
        }
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<UserDetailsDTO>> GetUserById(int id)
    {
        try
        {
            UserDetailsDTO user = await _repository.GetUserByIdAsync(id);

            if (user == null)
            {
                return NotFound("Notandi ekki til");
            }
            else
            {
                return Ok(user);
            }
        }
        catch (Exception)
        {
            return StatusCode(500);
        }
    }
    
    // Create

    [HttpPost]
    public async Task<IActionResult> CreateUser([FromBody] UserCreateDTO user)
    {
        try
        {
            if (ModelState.IsValid)
            {
                await _repository.CreateUserAsync(user);
                return Ok(user);
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
    
    
    //Login
    [HttpPost("login")]
    public async Task<ActionResult<UserReadDTO>> Login([FromBody] UserLoginDTO loginData)
    {
        try
        {
            var user = await _repository.LoginUserAsync(loginData.Email, loginData.Password);
            if (user == null)
            {
                return Unauthorized("Rangt netfang eða lykilorð");
            }
            return Ok(user);
        }
        catch (Exception)
        {
            return StatusCode(500);
        }
    }
    
    
    //Update
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateUser(int id, [FromBody] UserCreateDTO user)
    {
        try
        {
            UserReadDTO updateUser = await _repository.UpdateUserAsync(id, user);

            if (updateUser == null)
            {
                return NotFound();
            }
            else
            {
                return Ok(updateUser);
            }
        }
        catch (Exception)
        {
            return StatusCode(500);
        }
    }
    
    // Delete
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteUser(int id)
    {
        try
        {
            bool deleteSuccessfull = await _repository.DeleteUserAsync(id);

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
    
    //Leaderboard
    
    [HttpGet("leaderboard")]
    public async Task<ActionResult<List<UserReadDTO>>> GetLeaderboard()
    {
        try
        {
            var leaderboard = await _repository.GetLeaderboardAsync();
            return Ok(leaderboard);
        }
        catch (Exception)
        {
            return StatusCode(500);
        }
    }
    
    
}