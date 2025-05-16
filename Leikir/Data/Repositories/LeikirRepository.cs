using Leikir.Data.Interfaces;
using Leikir.Models;
using Leikir.Models.DTO.Game;
using Leikir.Models.DTO.Score;
using Leikir.Models.DTO.User;
using Microsoft.EntityFrameworkCore;
using User = Leikir.Models.User;
using BCrypt.Net;

namespace Leikir.Data.Repositories;

public class LeikirRepository : IRepository
{
    private LeikirContext _dbContext;

    public LeikirRepository()
    {
        _dbContext = new LeikirContext();
    }


    public async Task<List<UserReadDTO>> GetAllUsersAsync()
    {
        List<User> users;

        using (var db = _dbContext)
        {
            users = await db.Users
                .Include(u => u.Scores)
                .ToListAsync();
        }
        
        List<UserReadDTO> result = new List<UserReadDTO>();

        foreach (User user in users)
        {
            UserReadDTO userToAdd = new UserReadDTO();

            userToAdd.Id = user.Id;
            userToAdd.Name = user.Name;
            userToAdd.Username = user.Username;
            userToAdd.Email = user.Email;
            userToAdd.TotalScore = user.Scores?.Sum(s => s.UserScore) ?? 0;
            
            result.Add(userToAdd);
        }
        
        return result;
    }

    public async Task<UserDetailsDTO> GetUserByIdAsync(int id)
    {
        User? u;

        using (var db = _dbContext)
        {
            u = await db.Users
                .Include(u => u.Scores)
                .FirstOrDefaultAsync(x => x.Id == id);
        }

        if (u == null)
            return null;

        UserDetailsDTO result = new UserDetailsDTO()
        {
            UserId = u.Id,
            Name = u.Name,
            Username = u.Username,
            Email = u.Email,
            TotalScore = u.Scores?.Sum(s => s.UserScore) ?? 0
        };
        return result;
    }

    public async Task CreateUserAsync(UserCreateDTO user)
    {
        using (var db = _dbContext)
        {
            User us = new User
            {
                Name = user.Name,
                Username = user.Username,
                Email = user.Email,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(user.Password)
            };
            await db.Users.AddAsync(us);
            await db.SaveChangesAsync();
        }
    }

    public async Task<UserReadDTO> UpdateUserAsync(int id, UserCreateDTO user)
    {
        using (var db = _dbContext)
        {
            var userToUpdate = await db.Users.FirstOrDefaultAsync(x => x.Id == id);

            if (userToUpdate == null)
            {
                return null;
            }

            userToUpdate.Name = user.Name;
            userToUpdate.Username = user.Username;
            userToUpdate.Email = user.Email;
            userToUpdate.PasswordHash = BCrypt.Net.BCrypt.HashPassword(user.Password);

            await db.SaveChangesAsync();

            return new UserReadDTO()
            {
                Id = userToUpdate.Id,
                Name = userToUpdate.Name,
                Username = userToUpdate.Username,
                Email = userToUpdate.Email
            };
        }
    }

    public async Task<bool> DeleteUserAsync(int id)
    {
        User userToDelete;

        using (var db = _dbContext)
        {
            userToDelete = db.Users.FirstOrDefault(x => x.Id == id);

            if (userToDelete == null)
            {
                return false;
            }
            else
            {
                db.Users.Remove(userToDelete);
                await db.SaveChangesAsync();
                return true;
            }
        }
    }

    public async Task<List<ScoreDTO>> GetAllScoresAsync()
    {
        List<Score> scores;

        using (var db = _dbContext)
        {
            scores = await db.Scores.ToListAsync();
        }

        List<ScoreDTO> result = new List<ScoreDTO>();

        foreach (Score score in scores)
        {
            ScoreDTO scoreDto = new ScoreDTO();

            scoreDto.Id = score.Id;
            scoreDto.UserId = score.UserId;
            scoreDto.GameId = score.GameId;
            scoreDto.UserScore = score.UserScore;
            scoreDto.AchivedAt = score.AchivedAt;

            result.Add(scoreDto);
        }

        return result;
    }

    public async Task<ScoreDTO> GetAllScoresByUserIdAsync(int id)
    {
        Score? s;

        using (var db = _dbContext)
        {
            s = await db.Scores.FirstOrDefaultAsync(x => x.Id == id);
        }

        if (s == null)
        {
            return null;
        }

        ScoreDTO scoreDto = new ScoreDTO()
        {
            Id = s.Id,
            UserId = s.UserId,
            GameId = s.GameId,
            UserScore = s.UserScore,
            AchivedAt = s.AchivedAt
        };

        return scoreDto;
    }

    public async Task CreateScoreAsync(ScoreDTO score)
    {
        using (var db = _dbContext)
        {
            Score s = new Score
            {
                UserId = score.UserId,
                GameId = score.GameId,
                UserScore = score.UserScore,
                AchivedAt = score.AchivedAt
            };
            await db.Scores.AddAsync(s);
            await db.SaveChangesAsync();
        }
    }

public async Task<ScoreDTO> UpdateScoreAsync(int id, ScoreDTO score)
    {
        using (var db = _dbContext)
        {
            var scoreToUpdate = await db.Scores.FirstOrDefaultAsync(x => x.Id == id);

            if (scoreToUpdate == null)
            {
                return null;
            }

            scoreToUpdate.Id = score.Id;
            scoreToUpdate.UserScore = score.UserScore;
            
            await db.SaveChangesAsync();

            return new ScoreDTO()
            {
                Id = scoreToUpdate.Id,
                UserScore = scoreToUpdate.UserScore,
            };
        }
    }

    public async Task<bool> DeleteScoreAsync(int id)
    {
        Score scoreToDelete;

        using (var db = _dbContext)
        {
            scoreToDelete = db.Scores.FirstOrDefault(x => x.Id == id);

            if (scoreToDelete == null)
            {
                return false;
            }
            else
            {
                db.Scores.Remove(scoreToDelete);
                await db.SaveChangesAsync();
                return true;
            }
        }
    }

    public async Task<List<GameReadDTO>> GetAllGamesAsync()
    {
        List<Game> games;
        
        using (var db = _dbContext)
        {
            games = await db.Games.ToListAsync();
        }
        
        List<GameReadDTO> result = new List<GameReadDTO>();

        foreach (Game game in games)
        {
            GameReadDTO gameDto = new GameReadDTO();
            
            gameDto.Id = game.Id;
            gameDto.Name = game.Name;
            gameDto.Description = game.Description;
            
            result.Add(gameDto);
        }

        return result;
    }

    public async Task<GameReadDTO> GetGameByIdAsync(int id)
    {
        Game? g;

        using (var db = _dbContext)
        {
            g = await db.Games.FirstOrDefaultAsync(x => x.Id == id);
        }

        GameReadDTO gameToReturn = new GameReadDTO()
        {
            Id = g.Id,
            Name = g.Name,
            Description = g.Description
        };
        return gameToReturn;
    }

    public async Task CreateGameAsync(GameCreateDTO game)
    {
        using (var db = _dbContext)
        {
            Game ggame = new Game
            {
                Name = game.Name,
                Description = game.Description
            };
            await db.Games.AddAsync(ggame);
            await db.SaveChangesAsync();
        }
    }

    public async Task<GameDTO> UpdateGameAsync(int id, GameDTO game)
    {
        using (var db = _dbContext)
        {
            var gameToUpdate = await db.Games.FirstOrDefaultAsync(x => x.Id == id);

            if (gameToUpdate == null)
            {
                return null;
            } 
            
            gameToUpdate.Id = game.Id;
            gameToUpdate.Name = game.Name;
            gameToUpdate.Description = game.Description;
            
            await db.SaveChangesAsync();
            
            return new GameDTO()
            {
                Id = gameToUpdate.Id,
                Name = gameToUpdate.Name,
                Description = gameToUpdate.Description
            };
        };
    }

    public async Task<bool> DeleteGameAsync(int id)
    {
        Game gameToDelete;

        using (var db = _dbContext)
        {
            gameToDelete =  db.Games.FirstOrDefault(x => x.Id == id);

            if (gameToDelete == null)
            {
                return false;
            }
            else
            {
                db.Games.Remove(gameToDelete);
                await db.SaveChangesAsync();
                return true;
            }
        }
    }
}