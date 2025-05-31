using Leikir.Models;
using Leikir.Models.DTO.Game;
using Leikir.Models.DTO.Score;
using Leikir.Models.DTO.User;

namespace Leikir.Data.Interfaces;

public interface IRepository
{
  //User
  Task<List<UserReadDTO>> GetAllUsersAsync();
  
  Task<UserDetailsDTO> GetUserByIdAsync(int id);
  
  Task CreateUserAsync(UserCreateDTO user);
  
  Task<UserReadDTO?> LoginUserAsync(string email, string password);
  
  Task<UserReadDTO> UpdateUserAsync(int id, UserCreateDTO user);
  
  Task<bool> DeleteUserAsync(int id);
  
  Task<List<UserReadDTO>> GetLeaderboardAsync();
  
  
  //Score
  
  Task<List<ScoreDTO>> GetAllScoresAsync();
  
  Task<ScoreDTO> GetAllScoresByUserIdAsync(int id);
  
  Task CreateScoreAsync(ScoreDTO score);
  
  Task<ScoreDTO> UpdateScoreAsync(int id, ScoreDTO score);
  
  Task<bool> DeleteScoreAsync(int id);
  
  
  //Game
  
  Task<List<GameReadDTO>> GetAllGamesAsync();
  
  Task<GameReadDTO> GetGameByIdAsync(int id);
  
  Task CreateGameAsync(GameCreateDTO game);
  
  Task<GameDTO> UpdateGameAsync(int id, GameDTO game);
  
  Task<bool> DeleteGameAsync(int id);
}