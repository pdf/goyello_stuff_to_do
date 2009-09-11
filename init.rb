require 'redmine'

Dir[File.join(directory,'vendor','plugins','*')].each do |dir|
  path = File.join(dir, 'lib')
  $LOAD_PATH << path
  Dependencies.load_paths << path
  Dependencies.load_once_paths.delete(path)
end

require_dependency 'stuff_to_do_issue_patch.rb'

Redmine::Plugin.register :stuff_to_do_plugin do
  name 'Stuff To Do Plugin'
  author 'GOYELLO'
  author_url 'http://www.goyello.com'
  description "The Stuff To Do plugin allows a user to order and prioritize the issues they are doing into a specific order. It will also allow to register time for those issues."
  version '0.0.1'

  requires_redmine :version_or_higher => '0.8.0'

  project_module :stuff_to_do_module do
    permission :view_stuff_to_do, {:stuff_to_do => [:index]}, :require => :member
    permission :other_stuff_to_do_access, {:stuff_to_do => [:index]}, :require => :loggedin
  end

  # Turn off settings for the plugin
  #  settings :default => {'threshold' => '1', 'email_to' => 'example1@example.com,example2@example.com'},
  #    :partial => 'settings/stuff_to_do_settings'

  menu(:top_menu, :stuff_to_do, {:controller => "stuff_to_do", :action => 'index'},
    :caption => :stuff_to_do_title, :if => Proc.new { StuffToDoController.visible_projects.size > 0 })

end
