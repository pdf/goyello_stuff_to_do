class LogtimeEntry < ActiveRecord::Base
  belongs_to :issue
  belongs_to :user

  #
  #
  #
  def recorded_time
    if self.state == "Pending"
      time_diff = Time.now.to_i - self.start_date.to_i;
      hours = (time_diff / 3600).floor + self.hours;
      minutes = ((time_diff - hours * 3600) / 60).floor + self.minutes;
      time = hours + minutes / 60.0;
    else
      time = self.hours + self.minutes / 60.0;
    end

    return sprintf "%.2f", time;
  end

  def hours
    return (self.spent_time / 3600).floor;
  end

  def minutes
    return (((self.spent_time - self.hours * 3600)) / 60).floor;
  end

  def seconds
    return self.spent_time % 60;
  end

  #
  # Retrieve entries with some time recorded
  #
  def LogtimeEntry.all_recorded
    return self.all(:conditions => ["user_id = ? AND (spent_time > 5 OR state = 'Pending')",
        User.current.id]);
  end

  #
  #
  # # #
  def LogtimeEntry.find_by_issue_and_user(issue_id, user_id)
    return LogtimeEntry.first(:conditions => ["issue_id = ? AND user_id = ?",
        issue_id, user_id]);
  end

  #
  #
  # # # #
  def LogtimeEntry.delete_by_issue_and_user(issue_id, user_id)
    toDelete = LogtimeEntry.find_by_user_id_and_issue_id(user_id, issue_id);
    if(!toDelete.nil?)
      toDelete.destroy;
    end
  end

  #
  #
  # # # #
  def LogtimeEntry.Activities
    return Enumeration.find_all_by_opt("ACTI");
  end

  #
  #
  # # # #
  def LogtimeEntry.isPending?(issue_id, user_id)
    logtime_entry = LogtimeEntry.first(:conditions => ["issue_id = ? AND user_id = ?",
        issue_id, user_id]);

    return logtime_entry.nil? ? false : logtime_entry.state == 'Pending';
  end

  #
  # TODO Zamienić wyświetlanie na godziny:minuty TODO i ogólnie, żeby działało
  # na godzinach
  #
  def to_s
    if(self.state == 'Break')
      hours = self.hours;
      minutes = self.minutes;
      seconds = self.seconds
    else
      time_diff = Time.now.to_i - self.start_date.to_i;
      hours = (time_diff / 3600).floor + self.hours;
      minutes = ((time_diff - hours * 3600) / 60).floor + self.minutes;
      seconds = time_diff % 60 + self.seconds;

      if(seconds > 59)
        minutes += 1;
        seconds -= 60;
      end

      if(minutes > 59)
        hours += 1;
        minutes -= 60;
      end
    end

    return "#{to_tn hours}:#{to_tn minutes}:#{to_tn seconds}";
  end

  #
  # as_timer_number
  #
  def to_tn(value)
    return value<10 ? "0#{value.to_i}" : value.to_i.to_s;
  end

end

