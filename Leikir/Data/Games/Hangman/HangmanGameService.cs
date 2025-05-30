using Leikir.Data.Interfaces;
using Leikir.Models.DTO.Game.Hangman;
using Leikir.Models.DTO.Game.Wordle;
using Leikir.Models.DTO.Score;
using Leikir.Models;

namespace Leikir.Data.Games.Hangman;

public class HangmanGameService : IGameService
{
    private readonly TargetWordList _targetWordList;
    private readonly LeikirContext _context;
    private readonly Dictionary<int, HangmanGameStateDto> _activeGames;
    private const int MaxAttempts = 6;

    public HangmanGameService(TargetWordList targetWordList, LeikirContext context)
    {
        _targetWordList = targetWordList;
        _context = context;
        _activeGames = new Dictionary<int, HangmanGameStateDto>();
    }

    public async Task<ScoreDTO> StartNewGameAsync(int userId, int gameId)
    {
        // Check if user exists
        var user = await _context.Users.FindAsync(userId);
        if (user == null)
        {
            throw new ArgumentException("User not found");
        }

        // Get a random target word
        var targetWord = _targetWordList.GetRandomWord();

        // Create new game state
        var gameState = new HangmanGameStateDto
        {
            UserId = userId,
            GameId = gameId,
            TargetWord = targetWord,
            GuessedLetters = new List<char>(),
            WrongLetters = new List<char>(),
            NumberOfAttempts = 0,
            IsGameOver = false,
            IsWon = false,
            Score = 0,
            StartedAt = DateTime.UtcNow
        };

        // Store game state
        _activeGames[userId] = gameState;

        // Create and return score DTO
        return new ScoreDTO
        {
            UserId = userId,
            GameId = gameId,
            UserScore = 0,
            NumberOfAttempts = 0,
            GuessedWord = targetWord,
            AchivedAt = DateTime.UtcNow
        };
    }

    public async Task<ScoreDTO> GetCurrentGameStateAsync(int userId, int gameId)
    {
        if (_activeGames.TryGetValue(userId, out var gameState))
        {
            return new ScoreDTO
            {
                UserId = userId,
                GameId = gameId,
                UserScore = gameState.Score,
                NumberOfAttempts = gameState.NumberOfAttempts,
                GuessedWord = gameState.TargetWord,
                AchivedAt = gameState.StartedAt
            };
        }
        return null;
    }

    public async Task<WordleGuessResponseDto> MakeAttemptAsync(int userId, int gameId, string guess)
    {
        // Get current game state
        if (!_activeGames.TryGetValue(userId, out var gameState))
        {
            throw new InvalidOperationException("No active game found");
        }

        // Validate guess
        if (string.IsNullOrEmpty(guess) || guess.Length != 1)
        {
            throw new ArgumentException("Guess must be a single letter");
        }

        // Convert to uppercase for consistency
        var letter = char.ToUpper(guess[0]);

        // Check if game is already over
        if (gameState.IsGameOver)
        {
            throw new InvalidOperationException("Game is already over");
        }

        // Check if letter was already guessed
        if (gameState.GuessedLetters.Contains(letter))
        {
            throw new ArgumentException("Letter was already guessed");
        }

        // Add letter to guessed letters
        gameState.GuessedLetters.Add(letter);
        gameState.NumberOfAttempts++;

        // Check if letter is in the word
        var isCorrect = gameState.TargetWord.Contains(letter);
        var positions = new List<int>();

        if (isCorrect)
        {
            // Find all positions of the letter
            for (int i = 0; i < gameState.TargetWord.Length; i++)
            {
                if (gameState.TargetWord[i] == letter)
                {
                    positions.Add(i);
                }
            }

            // Check if word is complete
            var isWordComplete = gameState.TargetWord.All(c => gameState.GuessedLetters.Contains(c));
            if (isWordComplete)
            {
                gameState.IsGameOver = true;
                gameState.IsWon = true;
                gameState.Score = CalculateScore(gameState.NumberOfAttempts);
                gameState.CompletedAt = DateTime.UtcNow;

                // Save score to database
                await SaveScoreAsync(userId, gameId, gameState.Score);
            }
        }
        else
        {
            // Add to wrong letters
            gameState.WrongLetters.Add(letter);

            // Check if game is over (max 6 wrong attempts)
            if (gameState.WrongLetters.Count >= MaxAttempts)
            {
                gameState.IsGameOver = true;
                gameState.IsWon = false;
                gameState.CompletedAt = DateTime.UtcNow;
            }
        }

        // Create response with letter states for frontend
        var letterStates = new List<LetterState>();
        for (int i = 0; i < gameState.TargetWord.Length; i++)
        {
            if (gameState.GuessedLetters.Contains(gameState.TargetWord[i]))
            {
                letterStates.Add(LetterState.Correct);
            }
            else
            {
                letterStates.Add(LetterState.Absent);
            }
        }

        return new WordleGuessResponseDto
        {
            Guess = guess,
            LetterStates = letterStates,
            IsCorrect = isCorrect,
            IsGameOver = gameState.IsGameOver,
            IsWon = gameState.IsWon,
            Score = gameState.Score
        };
    }

    public async Task<string> GetDailyTargetWordAsync()
    {
        return _targetWordList.GetRandomWord();
    }

    public async Task<string> GetRandomTargetWordAsync()
    {
        return _targetWordList.GetRandomWord();
    }

    private string GetCurrentWordState(HangmanGameStateDto gameState)
    {
        return new string(gameState.TargetWord.Select(c => 
            gameState.GuessedLetters.Contains(c) ? c : '_').ToArray());
    }

    private int CalculateScore(int attempts)
    {
        // Base score is 1000, reduced by 100 for each attempt
        return Math.Max(1000 - (attempts - 1) * 100, 100);
    }

    private async Task SaveScoreAsync(int userId, int gameId, int score)
    {
        var scoreEntity = new Score
        {
            UserId = userId,
            GameId = gameId,
            UserScore = score,
            AchivedAt = DateTime.UtcNow
        };

        _context.Scores.Add(scoreEntity);
        await _context.SaveChangesAsync();
    }
}