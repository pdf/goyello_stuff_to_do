class CreateLogtimeEntries < ActiveRecord::Migration
  def self.up
    create_table :logtime_entries do |t|
      t.column :start_date, :timestamp, :null => true
      t.column :spent_time, :float, :null => false, :default => 0
      t.column :state, :string, :null => false, :default => 'New'
      t.column :issue_id, :integer, :null => false
      t.column :user_id, :integer, :null => false
    end
    add_index "logtime_entries", ["issue_id"], :name => "logtime_entries_issue_id"
    add_index "logtime_entries", ["user_id"], :name => "logtime_entries_user_id"
  end

  def self.down
    drop_table :logtime_entries
  end
end
