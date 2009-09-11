class StuffToDoController < ApplicationController
  unloadable

  before_filter :clear_cache
  before_filter :get_user
  before_filter :check_permission
  before_filter :require_admin, :only => :available_issues

  @@remote = false;

  include StuffToDoHelper
  include SortHelper
  helper :stuff_to_do
 
  helper :sort

  def self.visible_projects
    Project.find(:all, :conditions => Project.allowed_to_condition(User.current, :view_stuff_to_do))
  end

  #
  # Set stuff to do flag
  #
  def set_stuff_to_do_flag
    session[:stuff_to_do_flag] = 'true';
    render :nothing => true
  end

  #
  # Retrieve stuff to do flag
  #
  def get_stuff_to_do_flag
    flag = session[:stuff_to_do_flag].nil? ? 'false' : session[:stuff_to_do].to_s;
    render :text => flag;
  end

  def i_am_allowed?
    User.current.projects.each do |project|
      allowed = User.current.allowed_to?(:other_stuff_to_do_access, project)
      return true if allowed
    end

    return false;
  end

  #
  # 
  #
  def check_permission()
    if(User.current != @user)
      res = false;
      @user.projects.each do |project|
        res = true if User.current.allowed_to?(:other_stuff_to_do_access, project)
      end

      @user_allowed = res;
      render_403 if !res
    else
      @user_allowed = i_am_allowed?
    end
  end

  def index
    sort_init "#{Issue.table_name}.id", "desc"
    sort_update 'id' => "#{Issue.table_name}.id",
      'project' => "#{Project.table_name}.name",
      'tracker' => "#{Tracker.table_name}.name",
      'estimated' => "#{Issue.table_name}.estimated_hours",
      'subject' => "#{Issue.table_name}.subject";

    paused = LogtimeEntry.find_all_by_state_and_user_id('Paused', User.current.id);
    if(!paused.empty?)
      paused.each do |paused_entry|
        update_logtime_entry(User.current.id, paused_entry.issue_id, 'Break')
      end
    end
    
    fetch_issues(sort_clause)

    @i = 0;
    @users = User.all(:conditions => ["`members`.`project_id` IN (?)", User.current.projects.map(&:id)],
      :joins => "left join `members` on `members`.`user_id` = `users`.`id`").uniq
    @filters = filters_for_view

    if(!@@remote.nil? && @@remote == true)
      @@remote = false;
      render :action => 'index', :layout => false 
    else
      @@remote = false;
      respond_to do |format|
        format.html { render :action => 'index', :layout => !request.xhr? }
      end
    end
  end

  def StuffToDoController.plugin_exists?(name)
    plugins = Redmine::Plugin.all;
    if(!plugins.empty?)
      plugins.each do |plugin|
        if(plugin.id.to_s == name)
          return true;
        end
      end
    end

    return false;
  end

  #
  #
  #
  def end_of_work
    user_id = User.current.id
    pending_entry = LogtimeEntry.find_by_user_id_and_state(user_id,
      'Pending');

    if(!pending_entry.nil?)
      update_logtime_entry(user_id, pending_entry.id, 'Break')
    end

    logtime_entries = LogtimeEntry.all_recorded;
    @@remote = false;

    @entries = Array.new;
    if(!logtime_entries.nil?)
      logtime_entries.each do |entry|
        hsh = Hash.new
        hsh[:issue] = Issue.find_by_id(entry.issue_id);
        hsh[:logtime_entry] = entry;
        @entries << hsh
      end
    end

    if(@entries.length == 0)
      render :partial => 'no_time_recorded', :layout => true
    end
  end

  #
  # Reorder issues in 'doing now' list when one of them
  # has been moved to 'available'
  #
  def move_to_available
    user_id = User.current.id;
    issue_id = params[:issue_id];

    if(!issue_id.nil?)
      issue_to_delete = NextIssue.first(:conditions => ["issue_id = ? AND
          user_id = ?", issue_id, user_id]);
      
      issues = NextIssue.all(:conditions => ["id > ? AND user_id = ?",
          issue_to_delete.id, user_id])

      if(!issues.nil?)
        issues.each do |ni|
          ni.update_attribute(:position, ni.position - 1);
          ni.save;
        end
      end

      issue_to_delete.destroy if(!issue_to_delete.nil?)

      logtime_entry = LogtimeEntry.find_by_user_id_and_issue_id(user_id, issue_id);
      logtime_entry.destroy if(!logtime_entry.nil?)

      @@remote = true;
      redirect_to :action => 'index'
    else
      render :nothing => true;
    end
  end

  #
  #
  #
  def move_to_doing
    user_id = User.current.id;
    issue_id = params[:issue_id];

    in_next_issues = NextIssue.find_all_by_user_id_and_issue_id(user_id, issue_id);
    #in_next_issues = NextIssue.find_all_by_issue_id(issue_id);

    if(!issue_id.nil?)
      if(in_next_issues.nil? || in_next_issues.empty?)
        next_issues = NextIssue.find_all_by_user_id(user_id);
        if(!next_issues.nil?)
          next_issues.each do |ni|
            ni.update_attribute(:position, ni.position+1)
            ni.save;
          end
        end
      
        issue_to_add = NextIssue.create(:issue_id => issue_id, :user_id => user_id);
        issue_to_add.save;
        issue_to_add.update_attribute(:position, 1);
        issue_to_add.save;
      end

      @@remote = true;
      redirect_to :action => 'index'
    else
      render :nothing => true;
    end
  end

  def reset_recording
    issue_id = params[:issue_id];
    
    if(!issue_id.nil?)
      logtime_entry = LogtimeEntry.find_by_user_id_and_issue_id(User.current.id, issue_id);

      logtime_entry.destroy if !logtime_entry.nil?
    end
    
    render :nothing => true;
  end

  #
  # Action to handle logtime saving
  #
  def save_logtime
    # We're receiving data to save
    if(request.post?)
      logtime_params_array = params[:logtime_entry];

      # If there are more then one issue to save it's time (request from end of work page)
      if(request.env['HTTP_REFERER'].match(/end_of_work/))
        logtime_params_array.each do |logtime_params|
          issue = Issue.find_by_id(params[:issue_id][logtime_params[0]].to_i);
          if(!issue.nil?)
            ActiveRecord::Base.transaction do
              issue.update_attributes(
                :done_ratio => logtime_params[1]['done_ratio'].to_i,
                :assigned_to_id => logtime_params[1]['assigned_to'].to_i
              );
            
              if(logtime_params[1].include?('status'))
                issue.update_attribute(:status_id, logtime_params[1]['status'].to_i);
              end
            
              time_entry = TimeEntry.new(
                :project => Project.find_by_id(issue.project_id),
                :issue => issue,
                :user => User.current,
                :hours => removeDecimalComma(logtime_params[1]['spent_time']).to_f,
                :comments => logtime_params[1]['comments'],
                :activity_id => logtime_params[1]['activity'].to_i,
                :spent_on => logtime_params[1]['date']
              );

              # Delete logtime entry after saving it's data
              LogtimeEntry.delete(params[:recorded_time_id][logtime_params[0]].to_i)

              time_entry.save;
              issue.save;
            end
          end
        end

        redirect_to :action => 'index'
        # request from quick log time form
      else
        issue = Issue.find(params[:issue_id]['0']);
        logtime_params = logtime_params_array['0']
        if(!issue.nil?)
          ActiveRecord::Base.transaction do
            issue.update_attributes(
              :done_ratio => logtime_params['done_ratio'],
              :assigned_to_id => logtime_params['assigned_to'].to_i
            );

            if(logtime_params.include?('status'))
              issue.update_attribute(:status_id, logtime_params['status'].to_i);
            end

            time_entry = TimeEntry.new(
              :project => Project.find(issue.project_id),
              :issue => issue,
              :user => User.current,
              :hours => removeDecimalComma(logtime_params['spent_time']).to_f,
              :comments => logtime_params['comments'],
              :activity_id => logtime_params['activity'].to_i,
              :spent_on => logtime_params['date']
            );

            #            if(request.env['HTTP_REFERER'].match(/end_of_work/))
            #              LogtimeEntry.delete(params[:recorded_time_id][0].to_i)
            #            else
            logtime_entry = LogtimeEntry.find(params[:recorded_time_id]['0'].to_i);

            if(logtime_entry.state != 'Break')
              logtime_entry.update_attributes(
                :start_date => Time.now,
                :spent_time => 0.0
              );
              logtime_entry.save;
            else
              logtime_entry.destroy;
            end
            #            end
           
            time_entry.save;
            issue.save;
          end
          render :nothing => true;
        end
      
      end
      # When request is not POST render time saving form for one issue
    else
      logtime_entry = LogtimeEntry.find_by_issue_id_and_user_id(params[:issue_id], User.current.id);
      issue = Issue.find_by_id(params[:issue_id])

      b = Array.new
      a = Hash.new
      a[:issue] = issue;
      a[:logtime_entry] = logtime_entry;
      b << a

      render :partial => 'save_single_entry', :locals => { :col => b };
    end
  end

  def removeDecimalComma(number)
    return number.gsub(/,/, ".")
  end

  #
  #
  # # # #
  def issuePlay
    user_id = User.current.id;
    issue_id = params[:issue_id];

    logtime_entry = LogtimeEntry.find_by_user_id_and_issue_id(user_id, issue_id);
    
    if(logtime_entry.nil?)
      logtime_entry = LogtimeEntry.create(:start_date => Time.now, :issue_id => issue_id,
        :user_id => user_id, :state => 'Pending', :spent_time => 0);
    else
      logtime_entry.update_attributes(:state => 'Pending',
        :start_date => Time.now)
    end
    logtime_entry.save;
    render :nothing => true
  end

  #
  #
  #
  def update_logtime_entry(user_id, issue_id, new_state)
    logtime_entry = LogtimeEntry.find_by_user_id_and_issue_id(user_id, issue_id);

    if(!logtime_entry.nil?)
      time_diff = Time.now.to_i - logtime_entry.start_date.to_i;
      @time_count = time_diff + (logtime_entry.spent_time.nil? ? 0 : logtime_entry.spent_time)

      if(logtime_entry.state == 'Pending')
        if (@time_count.to_i > 2)
          logtime_entry.update_attributes(:spent_time => @time_count)
        end
      end

      logtime_entry.update_attributes(:state => new_state,
        :start_date => Time.now);

      logtime_entry.save;


    end
  end

  #
  #
  #
  def issue_break
    user_id = User.current.id;
    issue_id = params['issue_id'];
    new_state = params['paused'].nil? ? 'Break' : (params['paused'] == 'true' ? 'Paused' : 'Break');
    update_logtime_entry(user_id, issue_id, new_state)

    render :nothing => true
  end

  #
  #
  # # # #
  def issueLogTime
    @ratios = Array.new;
    
    params[:issue_id].each do |key, issue_id|
      issue = Issue.find_by_id(issue_id);
      time_entry = TimeEntry.create(
        :issue_id => issue_id, :hours => params[:spent_time][key],
        :comments => params[:comment][key], :activity_id => params[:activity_id][key]
      );
      time_entry.update_attributes(:user => User.current,
        :project_id => issue.project_id,
        :issue_id => issue_id,
        :spent_on => params[:start_date][key]
      );

      issue.update_attributes(:done_ratio => params[:done_ratio][key],
        :assigned_to_id => params[:assigned_to_id][key]
      );

      if(params.include?(:status_id))
        issue.update_attribute(:status_id, params[:status_id][key]);
      end

      issue.save;
      time_entry.save;

      logtime_entry = LogtimeEntry.find_by_user_id_and_issue_id(User.current.id, issue_id)
      logtime_entry.destroy;
    end

    render :nothing => true;
  end

  def fetch_issues(sort_clause)
    @doing_now = NextIssue.doing_now(@user)
    @recommended = NextIssue.recommended(@user)
    @available = NextIssue.available(@user, sort_clause, :user => @user)
    if(StuffToDoController.plugin_exists?('redmine_goyello_schedules'))
      @scheduled_issues = NextIssue.scheduled_issues(sort_clause);
      @scheduled_issues -= issues_for(@doing_now)
      @available -= @scheduled_issues;
    end
  end

  #
  #
  #
  def reorder
    sort_init "#{Issue.table_name}.id", "desc"
    sort_update 'id' => "#{Issue.table_name}.id",
      'project' => "#{Project.table_name}.name",
      'tracker' => "#{Tracker.table_name}.name",
      'estimated' => "#{Issue.table_name}.estimated_hours",
      'subject' => "#{Issue.table_name}.subject";
    
    NextIssue.reorder_list(@user, params[:issue])
    fetch_issues(sort_clause);

    respond_to do |format|
      format.html { redirect_to :action => 'index'}
      format.js {  @@remote = true; redirect_to :action => 'index' }
    end
  end

  #
  #
  #
  def available_issues
    @available = NextIssue.available(@user, get_filters)

    respond_to do |format|
      format.html { redirect_to :action => 'index'}
      format.js { render :partial => 'right_panes', :layout => false}
    end
  end
  
  private
  
  def get_user
    render_403 unless User.current.logged?
    if params[:user_id] && params[:user_id] != User.current.id.to_s
      @user = User.find(params[:user_id])
    else
      @user = User.current
    end
  end

  def clear_cache
    response.headers['Expires'] = "-1";
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0, post-check=0, pre-check=0, proxy-revalidate, s-maxage=0';
    response.headers['Pragma'] = 'no-cache';
  end
  
  def filters_for_view
    NextIssueFilter.new
  end
  
  def get_filters
    return { :user => @user } unless params[:filter]

    id = params[:filter].split('-')[-1]

    if params[:filter].match(/users/)
      return { :user => User.find_by_id(id) }
    elsif params[:filter].match(/priorities/)
      return { :priority => Enumeration.find_by_id(id) }
    elsif params[:filter].match(/statuses/)
      return { :status => IssueStatus.find_by_id(id) }
    else
      return nil
    end
  end
end