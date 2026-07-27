namespace SMS.Domain.Entities;

/// <summary>
/// A record of one phone/WhatsApp confirmation attempt for a COD order. Previously there was no
/// record that anyone ever called a customer at all - ConfirmedAt was null on essentially every
/// order, and a "no answer" simply meant the order sat there with no trace of the attempt.
/// </summary>
public class OrderConfirmationAttempt
{
    public long Id { get; set; }

    public int OnlineOrderId { get; set; }
    public OnlineOrder? OnlineOrder { get; set; }

    public int AttemptNumber { get; set; }
    public ConfirmationChannel Channel { get; set; }
    public ConfirmationOutcome Outcome { get; set; }

    public int? AgentUserId { get; set; }
    public string? Note { get; set; }
    public DateTime? NextCallbackAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public enum ConfirmationChannel
{
    Call = 0,
    WhatsApp = 1,
    Sms = 2
}

public enum ConfirmationOutcome
{
    Confirmed = 0,
    NoAnswer = 1,
    Busy = 2,
    WrongNumber = 3,
    Refused = 4,
    Postponed = 5,
    Duplicate = 6,
    AskedToChange = 7
}
